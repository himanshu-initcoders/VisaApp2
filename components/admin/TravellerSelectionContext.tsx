'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminStoredTraveller } from '@/components/admin/TravellersSection';
import type { DocumentWithVerification } from '@/types/admin';

interface TravellerSelectionContextValue {
  travellers: AdminStoredTraveller[];
  activeTravellerId: string;
  setActiveTravellerId: (id: string) => void;
  activeTraveller: AdminStoredTraveller | null;
  activeTravellerIndex: number;
  /** Documents belonging to the active traveller (by storage path). */
  filterDocuments: (
    documents: DocumentWithVerification[]
  ) => DocumentWithVerification[];
}

const TravellerSelectionContext =
  createContext<TravellerSelectionContextValue | null>(null);

export function travellerKey(
  traveller: AdminStoredTraveller,
  index: number
): string {
  return traveller.passengerId || `traveller-${index}`;
}

/** Match documents stored under .../passengers/{passengerId}/... */
export function documentBelongsToTraveller(
  doc: DocumentWithVerification,
  passengerId: string
): boolean {
  if (!passengerId) return false;
  const needle = `/passengers/${passengerId}/`;
  if (doc.s3Key.includes(needle)) return true;
  // Fallback: filename/metadata sometimes embeds passenger id
  return doc.s3Key.includes(passengerId);
}

export function TravellerSelectionProvider({
  travellers,
  children,
}: {
  travellers: AdminStoredTraveller[];
  children: ReactNode;
}) {
  const initialId =
    travellers.length > 0 ? travellerKey(travellers[0], 0) : '';
  const [activeTravellerId, setActiveTravellerId] = useState(initialId);

  const value = useMemo(() => {
    const activeTravellerIndex = Math.max(
      0,
      travellers.findIndex(
        (t, i) => travellerKey(t, i) === activeTravellerId
      )
    );
    const activeTraveller = travellers[activeTravellerIndex] ?? null;
    const resolvedId =
      activeTraveller != null
        ? travellerKey(activeTraveller, activeTravellerIndex)
        : activeTravellerId;

    return {
      travellers,
      activeTravellerId: resolvedId,
      setActiveTravellerId,
      activeTraveller,
      activeTravellerIndex,
      filterDocuments: (documents: DocumentWithVerification[]) => {
        if (!resolvedId || travellers.length <= 1) return documents;
        return documents.filter((doc) =>
          documentBelongsToTraveller(doc, resolvedId)
        );
      },
    };
  }, [travellers, activeTravellerId]);

  return (
    <TravellerSelectionContext.Provider value={value}>
      {children}
    </TravellerSelectionContext.Provider>
  );
}

export function useTravellerSelection() {
  const ctx = useContext(TravellerSelectionContext);
  if (!ctx) {
    throw new Error(
      'useTravellerSelection must be used within TravellerSelectionProvider'
    );
  }
  return ctx;
}

/** Optional hook when provider may be absent (legacy apps). */
export function useTravellerSelectionOptional() {
  return useContext(TravellerSelectionContext);
}
