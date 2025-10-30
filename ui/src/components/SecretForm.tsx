import { type FormEvent, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { encryptSecret, generateRandomAddress } from '../utils/crypto';
import '../styles/SecretForm.css';

type SecretFormProps = {
  onStored: () => Promise<void> | void;
};

export function SecretForm({ onStored }: SecretFormProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [successPassword, setSuccessPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isContractConfigured = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  const isSubmitDisabled = useMemo(() => {
    return (
      !address ||
      !message.trim() ||
      !instance ||
      zamaLoading ||
      !isContractConfigured ||
      isEncrypting ||
      isConfirming
    );
  }, [address, instance, isContractConfigured, isEncrypting, isConfirming, message, zamaLoading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessPassword(null);

    if (!address) {
      setError('Connect your wallet to store a secret.');
      return;
    }

    if (!instance) {
      setError('Encryption service is not ready.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Signer not available. Connect your wallet.');
      return;
    }

    if (!isContractConfigured) {
      setError('Update CONTRACT_ADDRESS in config before submitting secrets.');
      return;
    }

    try {
      setIsEncrypting(true);

      const passwordAddress = generateRandomAddress();
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(passwordAddress)
        .encrypt();

      const { ciphertextHex, ivHex } = await encryptSecret(message, passwordAddress);

      setIsEncrypting(false);
      setIsConfirming(true);

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      const tx = await contract.storeSecret(
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        ciphertextHex,
        ivHex,
        label.trim() || 'Untitled secret'
      );

      await tx.wait();

      setSuccessPassword(passwordAddress);
      setMessage('');
      setLabel('');

      await onStored();
    } catch (err) {
      console.error('Failed to store secret', err);
      const fallbackMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to store secret: ${fallbackMessage}`);
    } finally {
      setIsEncrypting(false);
      setIsConfirming(false);
    }
  };

  return (
    <section className="secret-form-card">
      <header className="section-header">
        <h2>Store a new secret</h2>
        <p>
          Encrypt your message locally with a random password. The password itself is protected with Zama FHE before it
          reaches the blockchain.
        </p>
      </header>

      <form className="secret-form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="secret-label">
          Label
        </label>
        <input
          id="secret-label"
          type="text"
          placeholder="Birthday surprise"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="form-input"
          maxLength={64}
        />

        <label className="form-label" htmlFor="secret-message">
          Message
        </label>
        <textarea
          id="secret-message"
          placeholder="Write the secret you'd like to protect..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="form-textarea"
          rows={4}
        />

        <button type="submit" className="primary-button" disabled={isSubmitDisabled}>
          {isEncrypting
            ? 'Encrypting...'
            : isConfirming
              ? 'Waiting for confirmation...'
              : 'Store secret'}
        </button>
      </form>

      {!address && <p className="helper-text">Connect your wallet to start saving encrypted messages.</p>}
      {zamaLoading && <p className="helper-text">Loading Zama encryption service...</p>}
      {zamaError && <p className="error-text">{zamaError}</p>}
      {error && <p className="error-text">{error}</p>}
      {successPassword && (
        <div className="success-box">
          <h3>Secret stored successfully</h3>
          <p className="success-description">
            Keep this reference handy. You can always decrypt it again from the list below.
          </p>
          <div className="password-display">
            <span>Password address:</span>
            <code>{successPassword}</code>
          </div>
        </div>
      )}
    </section>
  );
}
