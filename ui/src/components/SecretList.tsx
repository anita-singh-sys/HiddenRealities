import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { decryptSecret, normalizeDecryptedAddress } from '../utils/crypto';
import '../styles/SecretList.css';

export type SecretListEntry = {
  index: number;
  ciphertext: `0x${string}`;
  iv: `0x${string}`;
  passwordHandle: `0x${string}`;
  createdAt: number;
  label: string;
};

type SecretListProps = {
  secrets: SecretListEntry[];
  isLoading: boolean;
  hasWallet: boolean;
  onRefresh: () => Promise<unknown>;
};

type DecryptedSecret = {
  passwordAddress: `0x${string}`;
  message: string;
};

export function SecretList({ secrets, isLoading, hasWallet, onRefresh }: SecretListProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<number, DecryptedSecret>>({});

  const sortedSecrets = useMemo(() => {
    return [...secrets].sort((a, b) => b.createdAt - a.createdAt);
  }, [secrets]);

  const decryptEntry = async (entry: SecretListEntry) => {
    setError(null);

    if (!instance) {
      setError('Encryption service is not ready.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Signer not available. Connect your wallet.');
      return;
    }

    if (!address) {
      setError('Connect your wallet to decrypt secrets.');
      return;
    }

    try {
      setActiveIndex(entry.index);

      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        [
          {
            handle: entry.passwordHandle,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays
      );

      const decryptedPasswordRaw = result[entry.passwordHandle] as string;
      const passwordAddress = normalizeDecryptedAddress(decryptedPasswordRaw);
      const message = await decryptSecret(entry.ciphertext, entry.iv, passwordAddress);

      setDecryptedSecrets((prev) => ({
        ...prev,
        [entry.index]: { passwordAddress, message },
      }));
    } catch (err) {
      console.error('Failed to decrypt secret', err);
      const fallback = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to decrypt secret: ${fallback}`);
    } finally {
      setActiveIndex(null);
    }
  };

  return (
    <section className="secret-list-card">
      <header className="section-header">
        <h2>Stored secrets</h2>
        <p>
          Every entry holds your encrypted message, the IV used for symmetric encryption, and the password protected by
          FHE. Decrypt one to reveal the original message.
        </p>
      </header>

      {isLoading && <p className="helper-text">Loading secrets...</p>}

      {!isLoading && secrets.length === 0 && (
        <div className="empty-state">
          {hasWallet ? (
            <p>You have not stored any secrets yet.</p>
          ) : (
            <p>Connect your wallet to view stored secrets.</p>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {zamaError && <p className="error-text">{zamaError}</p>}

      <div className="secret-list">
        {sortedSecrets.map((entry) => {
          const decrypted = decryptedSecrets[entry.index];
          const createdAt = new Date(entry.createdAt * 1000);

          return (
            <article className="secret-item" key={`${entry.index}-${entry.createdAt}`}>
              <div className="secret-header">
                <div>
                  <h3>{entry.label || `Secret #${entry.index + 1}`}</h3>
                  <time dateTime={createdAt.toISOString()}>
                    Saved {createdAt.toLocaleString()}
                  </time>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => decryptEntry(entry)}
                  disabled={Boolean(decrypted) || zamaLoading || activeIndex === entry.index}
                >
                  {decrypted
                    ? 'Decrypted'
                    : activeIndex === entry.index
                      ? 'Decrypting...'
                      : 'Decrypt'}
                </button>
              </div>

              <div className="secret-body">
                <div className="secret-row">
                  <span className="secret-label">Ciphertext</span>
                  <code>{entry.ciphertext}</code>
                </div>
                <div className="secret-row">
                  <span className="secret-label">IV</span>
                  <code>{entry.iv}</code>
                </div>
                <div className="secret-row">
                  <span className="secret-label">Password handle</span>
                  <code>{entry.passwordHandle}</code>
                </div>
              </div>

              {decrypted && (
                <div className="decrypted-panel">
                  <div className="secret-row">
                    <span className="secret-label">Decrypted password</span>
                    <code>{decrypted.passwordAddress}</code>
                  </div>
                  <div className="secret-row">
                    <span className="secret-label">Original message</span>
                    <p className="secret-message">{decrypted.message}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {secrets.length > 0 && (
        <button className="ghost-button" onClick={() => onRefresh()}>
          Refresh secrets
        </button>
      )}
    </section>
  );
}
