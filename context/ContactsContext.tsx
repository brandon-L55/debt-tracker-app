import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useDebts } from "./DebtContext";
import type { Individual } from "./DebtContext";
import * as contactsService from "@/lib/services/contactsService";
import type { NewLinkedContact } from "@/lib/services/contactsService";
import { supabase } from "@/lib/supabase";

type ContactsContextType = {
  individuals: Individual[];
  /**
   * Async: awaiting ensures the contact is persisted before navigation.
   * Returns true if a matching contact already existed (nothing was inserted).
   */
  addIndividual: (individual: Omit<Individual, "id" | "createdAt">) => Promise<boolean>;
  /**
   * Async: creates a contact with full field support (linked_user_id, phone, email, invite).
   * Returns true if a matching contact already existed (nothing was inserted).
   */
  addLinkedIndividual: (data: NewLinkedContact) => Promise<boolean>;
  /** Optimistic: local state updates immediately; Supabase syncs in background. */
  updateIndividual: (id: string, updates: Partial<Omit<Individual, "id" | "createdAt">>) => void;
  /** Optimistic: local state updates immediately; Supabase syncs in background. */
  deleteIndividual: (id: string) => void;
  individualOrder: string[];
  /** Optimistic: local order updates immediately; Supabase syncs in background. */
  setIndividualOrder: (order: string[]) => void;
  /**
   * Inject already-persisted contacts into local state without a DB round-trip.
   * Skips any individual whose id is already present (no duplicates).
   * Used by GroupsContext to surface auto-created contacts immediately.
   */
  addCachedIndividuals: (toAdd: Individual[]) => void;
  isLoading: boolean;
  contactsError: string | null;
};

const ContactsContext = createContext<ContactsContextType | null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  // renameDebtPerson keeps local debts in sync when an individual's name changes.
  const { renameDebtPerson } = useDebts();

  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [individualOrder, setIndividualOrderState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Wait for auth to finish resolving before deciding whether to fetch.
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      setIndividuals([]);
      setIndividualOrderState([]);
      setIsLoading(false);
      return;
    }

    loadContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, authLoading]);

  // Realtime: reload the contact list whenever a new row is inserted for the
  // current user.  Covers two paths:
  //   (a) Creator side — findOrCreateContactByEmail just INSERTed a contact.
  //   (b) Recipient side — create_mirror_contact RPC just INSERTed a mirror
  //       contact so the sender appears in the recipient's Individuals tab.
  useEffect(() => {
    if (!session) return;

    const uid = session.user.id;
    const channel = supabase
      .channel(`contacts-inserts-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `owner_id=eq.${uid}`,
        },
        () => { loadContacts(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  async function loadContacts() {
    setIsLoading(true);
    setContactsError(null);
    try {
      const contacts = await contactsService.getContacts();
      setIndividuals(contacts);
      // Order is determined by sort_order in the DB.
      setIndividualOrderState(contacts.map(c => c.id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load contacts";
      setContactsError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function addIndividual(individual: Omit<Individual, "id" | "createdAt">): Promise<boolean> {
    if (!session) throw new Error("Not authenticated");
    const sortOrder = individuals.length;
    const { contact, existed } = await contactsService.createContact(individual, sortOrder);
    if (!existed) {
      setIndividuals(prev => [...prev, contact]);
      setIndividualOrderState(prev => [...prev, contact.id]);
    }
    return existed;
  }

  async function addLinkedIndividual(data: NewLinkedContact): Promise<boolean> {
    if (!session) throw new Error("Not authenticated");
    const sortOrder = individuals.length;
    const { contact, existed } = await contactsService.createLinkedContact(data, sortOrder);
    if (!existed) {
      setIndividuals(prev => [...prev, contact]);
      setIndividualOrderState(prev => [...prev, contact.id]);
    }
    return existed;
  }

  function updateIndividual(id: string, updates: Partial<Omit<Individual, "id" | "createdAt">>) {
    // Sync local debts when name changes (debts reference persons by name).
    if (updates.name !== undefined) {
      const existing = individuals.find(ind => ind.id === id);
      if (existing && updates.name !== existing.name) {
        renameDebtPerson(existing.name, updates.name);
      }
    }
    // Optimistic local update.
    setIndividuals(prev => prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind));
    // Background Supabase sync.
    contactsService.updateContact(id, updates).catch(e =>
      console.error("Failed to update contact:", e)
    );
  }

  function deleteIndividual(id: string) {
    // Optimistic remove.
    setIndividuals(prev => prev.filter(i => i.id !== id));
    setIndividualOrderState(prev => prev.filter(oid => oid !== id));
    // Background Supabase delete.
    contactsService.deleteContact(id).catch(e =>
      console.error("Failed to delete contact:", e)
    );
  }

  function setIndividualOrder(order: string[]) {
    setIndividualOrderState(order);
    contactsService.reorderContacts(order).catch(e =>
      console.error("Failed to reorder contacts:", e)
    );
  }

  function addCachedIndividuals(toAdd: Individual[]) {
    if (toAdd.length === 0) return;
    setIndividuals(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const fresh = toAdd.filter(i => !existingIds.has(i.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }

  return (
    <ContactsContext.Provider value={{
      individuals,
      addIndividual,
      addLinkedIndividual,
      updateIndividual,
      deleteIndividual,
      individualOrder,
      setIndividualOrder,
      addCachedIndividuals,
      isLoading,
      contactsError,
    }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
