import axios from 'axios';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

export const sendWelcomeEmail = async (email: string, name: string) => {
    if (!BREVO_API_KEY) {
        console.warn('BREVO_API_KEY not set. Skipping email.');
        return;
    }

    try {
        await axios.post(
            BREVO_API_URL,
            {
                sender: { name: 'TradeSphere Protocol', email: 'noreply@tradesphere.com' },
                to: [{ email, name }],
                subject: 'Welcome to TradeSphere Protocol',
                htmlContent: `<html><body><h1>Hello ${name}</h1><p>Welcome to our secure trade finance platform.</p></body></html>`
            },
            {
                headers: {
                    'api-key': BREVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`Welcome email sent to ${email}`);
    } catch (error: any) {
        console.error('Failed to send email:', error.response?.data || error.message);
    }
};
