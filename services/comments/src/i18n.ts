import type { Lang } from './sites.ts';

/** Strings of the sign-in popup and the emails sent to readers. */
const strings = {
  en: {
    signInTitle: 'Sign in to comment on {site}',
    signInIntro: 'Sign in to comment and react. Only the name you choose is shown publicly; your email address is never shown.',
    google: 'Continue with Google',
    or: 'or',
    emailLabel: 'Your email address',
    emailButton: 'Email me a sign-in link',
    devButton: 'Dev sign-in (no check)',
    checkInbox: 'We sent a link to {email}. Open it within 15 minutes, on this device or another one. This window closes once you are signed in.',
    invalidEmail: 'This email address does not look valid.',
    tooMany: 'Too many attempts. Please try again in an hour.',
    flowExpired: 'This sign-in has expired. Close this window and start again from the page.',
    unknownOrigin: 'This page is not allowed to use the comments service.',
    googleUnverified: 'Google has not verified the email address of this account. Please use the email link instead.',
    googleError: 'Google sign-in did not work. Please try again or use the email link.',
    confirmTitle: 'Confirm sign-in',
    confirmText: 'Sign in to {site} as {email}?',
    confirmButton: 'Sign in',
    linkInvalid: 'This link has expired or has already been used. Go back to the page and ask for a new link.',
    signedIn: 'You are signed in. You can close this window and return to the page.',
    mailSubject: 'Your sign-in link for {site}',
    mailText:
      'Hello,\n\nTo sign in to comment on {site}, open this link within 15 minutes:\n\n{link}\n\nIf you did not ask for it, ignore this message: nothing happens without the link.\n',
    noSignIn: 'Sign-in is not available yet. Please come back later.',
    privacy: 'By signing in, you agree that we store your email address and your comments. You can delete your account at any time.',
  },
  fr: {
    signInTitle: 'Connectez-vous pour commenter sur {site}',
    signInIntro: 'Connectez-vous pour commenter et réagir. Seul le nom que vous choisissez est affiché ; votre adresse e-mail ne l’est jamais.',
    google: 'Continuer avec Google',
    or: 'ou',
    emailLabel: 'Votre adresse e-mail',
    emailButton: 'Recevoir un lien de connexion',
    devButton: 'Connexion de développement (sans vérification)',
    checkInbox: 'Nous avons envoyé un lien à {email}. Ouvrez-le dans les 15 minutes, sur cet appareil ou un autre. Cette fenêtre se fermera une fois connecté.',
    invalidEmail: 'Cette adresse e-mail ne semble pas valide.',
    tooMany: 'Trop de tentatives. Réessayez dans une heure.',
    flowExpired: 'Cette connexion a expiré. Fermez cette fenêtre et recommencez depuis la page.',
    unknownOrigin: 'Cette page n’est pas autorisée à utiliser le service de commentaires.',
    googleUnverified: 'Google n’a pas vérifié l’adresse e-mail de ce compte. Utilisez plutôt le lien par e-mail.',
    googleError: 'La connexion avec Google n’a pas fonctionné. Réessayez ou utilisez le lien par e-mail.',
    confirmTitle: 'Confirmer la connexion',
    confirmText: 'Se connecter à {site} en tant que {email} ?',
    confirmButton: 'Se connecter',
    linkInvalid: 'Ce lien a expiré ou a déjà servi. Retournez sur la page et demandez un nouveau lien.',
    signedIn: 'Vous êtes connecté. Vous pouvez fermer cette fenêtre et revenir à la page.',
    mailSubject: 'Votre lien de connexion pour {site}',
    mailText:
      'Bonjour,\n\nPour vous connecter et commenter sur {site}, ouvrez ce lien dans les 15 minutes :\n\n{link}\n\nSi vous ne l’avez pas demandé, ignorez ce message : rien ne se passe sans le lien.\n',
    noSignIn: 'La connexion n’est pas encore disponible. Revenez plus tard.',
    privacy: 'En vous connectant, vous acceptez que nous conservions votre adresse e-mail et vos commentaires. Vous pouvez supprimer votre compte à tout moment.',
  },
  de: {
    signInTitle: 'Anmelden, um auf {site} zu kommentieren',
    signInIntro: 'Melden Sie sich an, um zu kommentieren und zu reagieren. Öffentlich erscheint nur der Name, den Sie wählen, nie Ihre E-Mail-Adresse.',
    google: 'Weiter mit Google',
    or: 'oder',
    emailLabel: 'Ihre E-Mail-Adresse',
    emailButton: 'Anmeldelink per E-Mail schicken',
    devButton: 'Entwickler-Anmeldung (ohne Prüfung)',
    checkInbox: 'Wir haben einen Link an {email} geschickt. Öffnen Sie ihn innerhalb von 15 Minuten, auf diesem oder einem anderen Gerät. Dieses Fenster schließt sich nach der Anmeldung.',
    invalidEmail: 'Diese E-Mail-Adresse scheint nicht gültig zu sein.',
    tooMany: 'Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut.',
    flowExpired: 'Diese Anmeldung ist abgelaufen. Schließen Sie dieses Fenster und beginnen Sie auf der Seite neu.',
    unknownOrigin: 'Diese Seite darf den Kommentardienst nicht verwenden.',
    googleUnverified: 'Google hat die E-Mail-Adresse dieses Kontos nicht bestätigt. Bitte nutzen Sie stattdessen den Link per E-Mail.',
    googleError: 'Die Anmeldung mit Google hat nicht funktioniert. Versuchen Sie es erneut oder nutzen Sie den Link per E-Mail.',
    confirmTitle: 'Anmeldung bestätigen',
    confirmText: 'Bei {site} als {email} anmelden?',
    confirmButton: 'Anmelden',
    linkInvalid: 'Dieser Link ist abgelaufen oder wurde schon benutzt. Gehen Sie zurück zur Seite und fordern Sie einen neuen an.',
    signedIn: 'Sie sind angemeldet. Sie können dieses Fenster schließen und zur Seite zurückkehren.',
    mailSubject: 'Ihr Anmeldelink für {site}',
    mailText:
      'Guten Tag,\n\num sich anzumelden und auf {site} zu kommentieren, öffnen Sie diesen Link innerhalb von 15 Minuten:\n\n{link}\n\nWenn Sie ihn nicht angefordert haben, ignorieren Sie diese Nachricht: Ohne den Link passiert nichts.\n',
    noSignIn: 'Die Anmeldung ist noch nicht verfügbar. Bitte schauen Sie später wieder vorbei.',
    privacy: 'Mit der Anmeldung stimmen Sie zu, dass wir Ihre E-Mail-Adresse und Ihre Kommentare speichern. Sie können Ihr Konto jederzeit löschen.',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Key = keyof (typeof strings)['en'];

export function t(lang: Lang, key: Key, vars: Record<string, string> = {}): string {
  return strings[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '');
}

export const serviceStrings = strings;
