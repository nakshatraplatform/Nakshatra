import styles from "./SocialLoginButton.module.css";

type Props = {
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
};

/** Signup presentation for the existing Google flow; provider policy stays in AuthForm. */
export function SocialLoginButton({ onClick, disabled, pending }: Props) {
  return (
    <div className={styles.group}>
      <button type="button" className={styles.button} onClick={onClick} disabled={disabled} aria-busy={pending}>
        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 488 512" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
        </svg>
        <span>{pending ? "Connecting to Google…" : "Sign up with Google"}</span>
      </button>
    </div>
  );
}
