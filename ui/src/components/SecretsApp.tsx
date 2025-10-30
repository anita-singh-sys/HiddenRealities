import { useCallback } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { Header } from './Header';
import { SecretForm } from './SecretForm';
import { SecretList, type SecretListEntry } from './SecretList';
import '../styles/SecretsApp.css';

export function SecretsApp() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const {
    data: secretCount = 0n,
    refetch: refetchCount,
    isFetching: isFetchingCount,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getSecretCount',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const {
    data: secrets = [],
    refetch: refetchSecrets,
    isLoading: isLoadingSecrets,
    isFetching: isFetchingSecrets,
  } = useQuery<SecretListEntry[]>({
    queryKey: ['secrets', address, secretCount?.toString()],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address || !secretCount) {
        return [];
      }

      const countNumber = Number(secretCount);
      if (countNumber === 0) {
        return [];
      }

      const entries = await Promise.all(
        Array.from({ length: countNumber }, async (_, index) => {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getSecret',
            args: [address, BigInt(index)],
          });

          return {
            index,
            ciphertext: result[0] as `0x${string}`,
            iv: result[1] as `0x${string}`,
            passwordHandle: result[2] as `0x${string}`,
            createdAt: Number(result[3]),
            label: result[4] as string,
          };
        })
      );

      return entries;
    },
  });

  const handleSecretStored = useCallback(async () => {
    await refetchCount();
    await refetchSecrets();
  }, [refetchCount, refetchSecrets]);

  const isLoading = isLoadingSecrets || isFetchingSecrets || isFetchingCount;

  return (
    <div className="app-shell">
      <Header />
      <main className="vault-content">
        <SecretForm onStored={handleSecretStored} />
        <SecretList
          secrets={secrets}
          isLoading={isLoading}
          hasWallet={Boolean(address)}
          onRefresh={refetchSecrets}
        />
      </main>
    </div>
  );
}
