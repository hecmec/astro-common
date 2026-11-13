import nodemailer from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Keeps mails in memory; used by tests. */
export class MemoryMailer implements Mailer {
  sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
}

/** Prints mails to the log; used in development when SMTP_URL is not set. */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    console.log(`\n--- mail to ${mail.to}: ${mail.subject}\n${mail.text}\n---\n`);
  }
}

export function createMailer(smtpUrl: string | undefined, from: string): Mailer {
  if (!smtpUrl) return new ConsoleMailer();
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(mail) {
      await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}
