import { LogoMark } from "@/components/LogoMark";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <a href="#top" className="logo">
          <span className="logo__mark">
            <LogoMark />
          </span>
          CRAZY<span>REP</span>
        </a>
        <p>Snap it. Log it. Know it.</p>
      </div>
      <div className="footer__cols">
        <div>
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#scanner">AI scanner</a>
        </div>
        <div>
          <h4>Get started</h4>
          <a href="#access">Request access</a>
          <a href="/login">Sign in</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="/privacy">Privacy</a>
        </div>
      </div>
      <p className="footer__copy">© 2026 Crazy Rep. All rights reserved.</p>
    </footer>
  );
}
