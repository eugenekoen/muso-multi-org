# Simple Welcome Email Setup (Supabase Dashboard)

Since you prefer the direct approach, follow these steps to set up your beautiful welcome email without needing any coding or external services like Resend.

## 1. Copy the Template
Open your [welcome_email.html](file:///c:/Users/eugen/Documents/GitHub/muso-multi-org/assets/master/welcome_email.html) and copy the **entire content** of the file.

## 2. Paste into Supabase
1. Log in to your **Supabase Dashboard**.
2. Go to **Authentication** -> **Email Templates** on the left sidebar.
3. Select the **Confirm Signup** tab.
4. In the **Message Body** section, delete everything and paste the HTML content you copied in Step 1.

## 3. Update the Subject
In the **Subject** field above the code box, you can change it to something friendly like:
`Welcome to Music In His Name! | Confirm your registration`

## 4. Save Changes
Click the **Save** button at the bottom of the page.

---

### Why this works:
- **No Extra Cost**: You're using Supabase's built-in email quota.
- **Instant Activation**: This email will now be sent automatically to every new person who signs up.
- **Verification**: The "Confirm Email" button in the template uses `{{ .ConfirmationURL }}`, which is a special Supabase code that will verify the user's account and log them into the app automatically after they click it.

### Professional Tip:
If you want the email to come from `eugene@mihn.co.za` instead of the default Supabase address, go to **Authentication** -> **Auth Settings** -> **SMTP Settings** and enter your Zoho SMTP details there.
