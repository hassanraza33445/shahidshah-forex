import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2";

/* SMTP secrets */
const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

/* Zoom secrets */
const ZOOM_ACCOUNT_ID = Deno.env.get("ZOOM_ACCOUNT_ID");
const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID");
const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET");
const ZOOM_WEBINAR_ID = String(
  Deno.env.get("ZOOM_WEBINAR_ID") || "",
).replace(/\s+/g, "");

/* Supabase server credentials */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
);

const SUPABASE_SECRET_KEY =
  SECRET_KEYS.default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (request.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: "Method not allowed",
        },
        405,
      );
    }

    validateSecrets();

    const body = await request.json();

    const submittedName = String(body?.name || "").trim();
    const submittedEmail = String(body?.email || "")
      .trim()
      .toLowerCase();

    if (!submittedName || !submittedEmail) {
      return jsonResponse(
        {
          success: false,
          error: "Participant name or email is missing.",
        },
        400,
      );
    }

    if (!isValidEmail(submittedEmail)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid participant email address.",
        },
        400,
      );
    }

    /*
     * Confirm that this user has already completed the website
     * registration before registering them with Zoom.
     */
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SECRET_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: registration, error: registrationError } =
      await supabase
        .from("webinar_registrations")
        .select("id, name, email, whatsapp")
        .eq("email", submittedEmail)
        .maybeSingle();

    if (registrationError) {
      throw new Error(
        `Unable to verify website registration: ${registrationError.message}`,
      );
    }

    if (!registration) {
      return jsonResponse(
        {
          success: false,
          error: "A valid website registration was not found.",
        },
        403,
      );
    }

    const participantName = String(
      registration.name || submittedName,
    ).trim();

    const participantEmail = String(
      registration.email || submittedEmail,
    )
      .trim()
      .toLowerCase();

    const { firstName, lastName } = splitFullName(participantName);

    /*
     * Get Zoom Server-to-Server OAuth access token.
     */
    const zoomAccessToken = await getZoomAccessToken();

    /*
     * Automatically add this user as a Zoom webinar registrant.
     */
    const zoomRegistration = await registerZoomParticipant({
      accessToken: zoomAccessToken,
      firstName,
      lastName,
      email: participantEmail,
    });

    /*
     * Send confirmation email from no-reply@smshahidshah.com.
     * There is no Zoom registration button because Zoom registration
     * has already been completed automatically.
     */
    await sendConfirmationEmail({
      participantName,
      participantEmail,
    });

    console.log("Registration completed successfully", {
      registrationId: registration.id,
      email: participantEmail,
      zoomRegistrantId: zoomRegistration.registrantId,
    });

    return jsonResponse({
      success: true,
      message:
        "Participant registered successfully on the website and Zoom webinar.",
      zoom_registered: true,
    });
  } catch (error) {
    console.error("Function error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown function error",
      },
      500,
    );
  }
});

function validateSecrets() {
  const missing: string[] = [];

  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_USERNAME) missing.push("SMTP_USERNAME");
  if (!SMTP_PASSWORD) missing.push("SMTP_PASSWORD");

  if (!ZOOM_ACCOUNT_ID) missing.push("ZOOM_ACCOUNT_ID");
  if (!ZOOM_CLIENT_ID) missing.push("ZOOM_CLIENT_ID");
  if (!ZOOM_CLIENT_SECRET) missing.push("ZOOM_CLIENT_SECRET");
  if (!ZOOM_WEBINAR_ID) missing.push("ZOOM_WEBINAR_ID");

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SECRET_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required secrets: ${missing.join(", ")}`,
    );
  }
}

async function getZoomAccessToken(): Promise<string> {
  const basicCredentials = btoa(
    `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`,
  );

  const tokenUrl = new URL(
    "https://zoom.us/oauth/token",
  );

  tokenUrl.searchParams.set(
    "grant_type",
    "account_credentials",
  );

  tokenUrl.searchParams.set(
    "account_id",
    ZOOM_ACCOUNT_ID!,
  );

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const result = await response.json();

  if (!response.ok || !result?.access_token) {
    console.error("Zoom token error:", result);

    throw new Error(
      `Zoom authentication failed: ${
        result?.reason ||
        result?.error ||
        result?.message ||
        "Unable to generate access token"
      }`,
    );
  }

  return result.access_token;
}

async function registerZoomParticipant({
  accessToken,
  firstName,
  lastName,
  email,
}: {
  accessToken: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const response = await fetch(
    `https://api.zoom.us/v2/webinars/${encodeURIComponent(
      ZOOM_WEBINAR_ID,
    )}/registrants`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Zoom registrant error:", result);

    const zoomMessage = String(
      result?.message || "Zoom registration failed",
    );

    /*
     * Treat an existing Zoom registrant as successful so the website
     * does not show an unnecessary error on a retry.
     */
    if (
      response.status === 409 ||
      zoomMessage.toLowerCase().includes("already registered")
    ) {
      return {
        registrantId: null,
        alreadyRegistered: true,
      };
    }

    throw new Error(
      `Zoom registration failed: ${zoomMessage}`,
    );
  }

  return {
    registrantId: result?.registrant_id || null,
    alreadyRegistered: false,
  };
}

async function sendConfirmationEmail({
  participantName,
  participantEmail,
}: {
  participantName: string;
  participantEmail: string;
}) {
  const safeName = escapeHtml(participantName);
  const safeEmail = escapeHtml(participantEmail);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USERNAME,
      pass: SMTP_PASSWORD,
    },
  });

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webinar Registration Confirmed</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }

      .mobile-pad {
        padding-left: 18px !important;
        padding-right: 18px !important;
      }

      .mobile-title {
        font-size: 30px !important;
        line-height: 36px !important;
      }

      .mobile-copy {
        font-size: 15px !important;
        line-height: 23px !important;
      }

      .info-icon {
        width: 44px !important;
        height: 44px !important;
        line-height: 44px !important;
        font-size: 21px !important;
      }

      .info-icon-cell {
        width: 54px !important;
      }

      .support-column {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        margin-bottom: 10px !important;
      }

      .support-gap {
        display: none !important;
      }

      .email-pill {
        max-width: 100% !important;
        word-break: break-word !important;
      }

      .website-button {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>

<body style="margin:0;padding:0;background:transparent;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="width:100%;background:transparent;">
    <tr>
      <td align="center" style="padding:12px 0;">

        <table class="email-shell" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="width:100%;max-width:600px;background:#0b1729;border:1px solid #12b981;border-radius:18px;overflow:hidden;">

          <tr>
            <td class="mobile-pad" align="center" style="padding:28px 24px 16px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td align="center" valign="middle"
                    style="width:68px;height:68px;border:2px solid #f5a623;border-radius:50%;background:#10283a;overflow:hidden;box-shadow:0 8px 22px rgba(245,166,35,.22);">
                    <img src="https://smshahidshah.com/shahid-shah-profile.jpg"
                      width="68" height="68" alt="S M Shahid Shah"
                      style="display:block;width:68px;height:68px;border:0;border-radius:50%;object-fit:cover;object-position:center top;">
                  </td>
                </tr>
              </table>

              <div style="margin-top:15px;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;color:#f5a623;">
                REGISTRATION CONFIRMED
              </div>

              <h1 class="mobile-title"
                style="margin:8px 0 10px;font-size:32px;line-height:39px;font-weight:800;color:#ffffff;">
                Congratulations, ${safeName}!
              </h1>

              <p class="mobile-copy"
                style="margin:0 auto;max-width:470px;font-size:15px;line-height:24px;color:#d0d7e2;">
                Your seat for the S M Shahid Shah Live Webinar has been successfully reserved.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="margin:15px auto 0;max-width:100%;">
                <tr>
                  <td class="email-pill" align="center"
                    style="padding:9px 18px;border:1px solid #f5a623;border-radius:24px;background:#111e32;font-size:13px;line-height:19px;font-weight:700;color:#f5a623;">
                    ${safeEmail}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:14px 20px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="width:100%;background:#101d31;border:1px solid #245347;border-radius:15px;">

                <tr>
                  <td style="padding:20px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td class="info-icon-cell" width="56" valign="top" style="width:56px;">
                          <div class="info-icon"
                            style="width:44px;height:44px;border:1px solid #12b981;border-radius:14px;background:#102d32;text-align:center;line-height:44px;font-size:22px;color:#16d49a;">
                            ✓
                          </div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;line-height:20px;font-weight:800;color:#16d49a;">
                            YOUR ZOOM REGISTRATION IS COMPLETE
                          </div>
                          <p class="mobile-copy" style="margin:6px 0 0;font-size:14px;line-height:22px;color:#d0d7e2;">
                            You have been automatically registered for Zoom. No further registration is required.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 18px;">
                    <div style="height:1px;background:#334155;"></div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td class="info-icon-cell" width="56" valign="top" style="width:56px;">
                          <div class="info-icon"
                            style="width:44px;height:44px;border:1px solid #12b981;border-radius:14px;background:#102d32;text-align:center;line-height:44px;font-size:20px;color:#16d49a;">
                            ✉
                          </div>
                        </td>
                        <td valign="top">
                          <p class="mobile-copy" style="margin:0;font-size:14px;line-height:22px;color:#d0d7e2;">
                            Zoom will send your personal joining link to your registered email. Please check Inbox, Spam and Promotions.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 18px;">
                    <div style="height:1px;background:#334155;"></div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td class="info-icon-cell" width="56" valign="top" style="width:56px;">
                          <div class="info-icon"
                            style="width:44px;height:44px;border:1px solid #12b981;border-radius:14px;background:#102d32;text-align:center;line-height:44px;font-size:20px;color:#16d49a;">
                            ◈
                          </div>
                        </td>
                        <td valign="top">
                          <p class="mobile-copy" style="margin:0;font-size:14px;line-height:22px;color:#d0d7e2;">
                            For security, please do not share your personal Zoom joining link.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" align="center" style="padding:16px 20px 20px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="width:100%;max-width:310px;margin:0 auto;">
                <tr>
                  <td align="center" style="background:#f5a623;border-radius:12px;">
                    <a class="website-button"
                      href="https://smshahidshah.com"
                      target="_blank"
                      style="display:inline-block;padding:14px 28px;font-size:15px;line-height:20px;font-weight:800;color:#08111f;text-decoration:none;">
                      VISIT OUR WEBSITE
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:0 20px;">
              <div style="height:1px;background:#334155;"></div>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" align="center" style="padding:16px 20px 10px;">
              <div style="font-size:17px;line-height:24px;font-weight:800;color:#ffffff;">
                Need help? Contact our team
              </div>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:0 20px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td class="support-column" width="49%" valign="top"
                    style="width:49%;background:#101d31;border:1px solid #334155;border-radius:13px;padding:14px;box-sizing:border-box;">
                    <div style="font-size:13px;line-height:19px;color:#cbd5e1;">Ms. Maryam Javed</div>
                    <a href="https://wa.me/601120506427"
                      style="display:block;margin-top:4px;font-size:15px;line-height:22px;font-weight:800;color:#ffffff;text-decoration:none;">
                      +60 11 2050 6427
                    </a>
                  </td>

                  <td class="support-gap" width="2%" style="width:2%;"></td>

                  <td class="support-column" width="49%" valign="top"
                    style="width:49%;background:#101d31;border:1px solid #334155;border-radius:13px;padding:14px;box-sizing:border-box;">
                    <div style="font-size:13px;line-height:19px;color:#cbd5e1;">Ms. Malaika Shahid</div>
                    <a href="https://wa.me/601156958905"
                      style="display:block;margin-top:4px;font-size:15px;line-height:22px;font-weight:800;color:#ffffff;text-decoration:none;">
                      +60 11-5695 8905
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:0 20px;">
              <div style="height:1px;background:#334155;"></div>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" align="center" style="padding:16px 20px 22px;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#cbd5e1;">Regards,</p>
              <p style="margin:2px 0 0;font-size:15px;line-height:22px;font-weight:800;color:#ffffff;">
                Team S M Shahid Shah
              </p>
              <p style="margin:4px 0 0;">
                <a href="https://smshahidshah.com"
                  style="font-size:13px;line-height:20px;color:#16d49a;text-decoration:none;">
                  www.smshahidshah.com
                </a>
              </p>
              <p style="margin:12px auto 0;max-width:400px;font-size:10px;line-height:16px;color:#718096;">
                You are receiving this email because you registered for the S M Shahid Shah webinar.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const result = await transporter.sendMail({
    from: `"S M Shahid Shah" <${SMTP_USERNAME}>`,
    to: participantEmail,
    subject:
      "Your Webinar Registration Has Been Confirmed",
    html: emailHtml,
  });

  console.log(
    "Confirmation email sent:",
    result.messageId,
  );
}

function splitFullName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: ".",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
