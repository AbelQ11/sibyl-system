import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
	return Boolean(env.SMTP_HOST || env.SMTP_URL);
}

function getTransporter(): Transporter {
	if (transporter) return transporter;

	const host = env.SMTP_HOST || env.SMTP_URL;
	if (!host) throw new Error('SMTP is not configured');

	const port = Number(env.SMTP_PORT || 465);
	const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;

	transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
		connectionTimeout: 15_000,
		greetingTimeout: 15_000,
		socketTimeout: 20_000
	});

	return transporter;
}

export async function verifyMailer(): Promise<boolean> {
	if (!isMailConfigured()) return false;
	try {
		await getTransporter().verify();
		return true;
	} catch (e) {
		console.error('[SIBYL MAIL] SMTP verification failed:', e);
		return false;
	}
}

export async function sendMail(options: {
	to: string;
	subject: string;
	text: string;
	html?: string;
}): Promise<void> {
	const from = env.MAIL_FROM || env.SMTP_USER;
	if (!from) throw new Error('MAIL_FROM is not configured');

	await getTransporter().sendMail({
		from,
		to: options.to,
		subject: options.subject,
		text: options.text,
		html: options.html
	});
}
