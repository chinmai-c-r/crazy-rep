export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <a href="#top" className="logo">
          <span className="logo__mark">⚡</span>
          CRAZY<span>REP</span>
        </a>
        <p>Eat smart. Train hard. Rep together.</p>
      </div>
      <div className="footer__cols">
        <div>
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#scanner">AI Scanner</a>
          <a href="#workouts">Workouts</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <h4>Community</h4>
          <a href="#community">Recipes</a>
          <a href="#community">Challenges</a>
          <a href="#community">Crews</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#top">About</a>
          <a href="#top">Privacy</a>
          <a href="#top">Terms</a>
        </div>
      </div>
      <p className="footer__copy">© 2026 Crazy Rep. All rights reserved.</p>
    </footer>
  );
}
