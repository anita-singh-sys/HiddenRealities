import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              Hidden Realities Vault
            </h1>
            <p className="header-subtitle">
              Store encrypted memories while keeping your password sealed with Zama FHE.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
