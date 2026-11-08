import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const recipient = process.argv[2] || process.env.MAIL_TO || 'contact@kiliotsu.eu';

const host = process.env.SMTP_HOST || process.env.SMTP_URL;
const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM || user;

if (!host || !user || !pass || !from) {
	console.error(
		'SMTP_HOST/SMTP_URL, SMTP_USER, SMTP_PASS and MAIL_FROM must be configured in .env'
	);
	process.exit(1);
}

const transporter = nodemailer.createTransport({
	host,
	port,
	secure,
	auth: { user, pass },
	connectionTimeout: 15000,
	greetingTimeout: 15000,
	socketTimeout: 20000
});

const info = await transporter.sendMail({
	from,
	to: recipient,
	subject: 'SIBYL SYSTEM // mail relay verification',
	text: [
		'This is an automated verification message from the SIBYL SYSTEM server.',
		'',
		'If you received this message, the configured mailbox can send and receive mail.',
		`Sender: ${from}`,
		`Timestamp: ${new Date().toISOString()}`
	].join('\n')
});

console.log(`SENT ${info.messageId} from ${from} to ${recipient} via ${host}:${port}`);
transporter.close();
