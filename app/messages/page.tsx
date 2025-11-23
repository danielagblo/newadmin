'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import Drawer from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { messagesApi } from '@/lib/api/chats';
import { Message } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

export default function MessagesPage() {
    // Start with an empty list; do not use mock data.
    const [items, setItems] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Message | null>(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    // Local-only replies keyed by message id. These are not persisted to `items`.
    const [localReplies, setLocalReplies] = useState<Record<number, Message[]>>({});
    const [search, setSearch] = useState('');

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const data = await messagesApi.list();

            // If the API returned no messages or an invalid shape, fall back to mock messages
            if (!Array.isArray(data) || data.length === 0) {
                console.warn('Messages API returned empty/invalid data; leaving list empty');
                // Leave the list empty when the API returns no data.
                setItems([]);
            } else {
                setItems(data);
            }
        } catch (err) {
            console.error('Error fetching messages', err);
            // Fallback: leave the list empty so UI remains predictable when backend is down.
            console.warn('Messages API error — showing empty list');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    const handleSelect = async (m: Message) => {
        try {
            const full = await messagesApi.get(m.id);
            setSelected(full);
        } catch (err) {
            // If get fails, fall back to the item itself
            console.error('Error fetching message, falling back to list item', err);
            setSelected(m);
        }
    };

    const handleReply = async () => {
        if (!selected) return;
        if (!reply.trim()) return window.alert('Please enter a reply');
        setSending(true);
        try {
            // Use replyToMessage helper which will create a room if needed
            const sent = await messagesApi.replyToMessage(selected.id, reply.trim());
            // Do NOT update the messages list. Keep the reply local to the
            // drawer so admins can preview the reply without persisting it to
            // the main table. Append to `localReplies` for rendering inside
            // the drawer only.
            const replyMsg: any = {
                id: sent?.id ?? Date.now(),
                room: sent?.room ?? selected.room ?? null,
                sender: { id: 0, name: 'Admin (you)' },
                content: reply.trim(),
                created_at: new Date().toISOString(),
            };

            setLocalReplies((prev) => ({
                ...prev,
                [selected.id]: [...(prev[selected.id] || []), replyMsg],
            }));

            setReply('');
            window.alert('Reply sent');
            // Refresh selected details for the drawer (does not touch list)
            try {
                const refreshed = await messagesApi.get(selected.id);
                setSelected(refreshed);
            } catch (e) {
                // If refresh fails, keep selected as-is — replies are visible from localReplies
                console.warn('Could not refresh message after reply', e);
            }
        } catch (err) {
            console.error('Error sending reply', err);
            // Fallback: simulate a reply locally so admin can see the flow even without backend.
            console.warn('Falling back to simulated reply (offline mode)');
            const dummyMessage: any = {
                id: Date.now(),
                room: selected.room ?? null,
                sender: { id: 0, name: 'Admin (local)' },
                content: reply.trim(),
                created_at: new Date().toISOString(),
            };

            // Append to localReplies instead of adding to the main items list.
            setLocalReplies((prev) => ({
                ...prev,
                [selected.id]: [...(prev[selected.id] || []), dummyMessage],
            }));

            setReply('');
            // keep the selected message open and show notice
            window.alert('Reply simulated locally (offline).');
        } finally {
            setSending(false);
        }
    };

    const handleClose = async () => {
        if (!selected) return;
        if (!confirm('Close this support case?')) return;
        setSending(true);
        try {
            await messagesApi.close(selected.id);
            await fetchMessages();
            setSelected(null);
            window.alert('Case closed');
        } catch (err) {
            console.error('Error closing message', err);
            // Fallback: simulate close locally so admin can see the flow even without backend.
            console.warn('Falling back to simulated close (offline mode)');
            setItems((prev) => prev.filter((it) => it.id !== selected.id));
            setSelected(null);
            window.alert('Case closed locally (simulated).');
        } finally {
            setSending(false);
        }
    };

    // demo loader removed; mock messages are loaded by default

    const columns = [
        { key: 'id', header: 'ID' },
        {
            key: 'room',
            header: 'Room',
            render: (m: Message) => (m.room ? String(m.room) : '-'),
        },
        {
            key: 'sender',
            header: 'Sender',
            render: (m: Message) => {
                const s = (m.sender as any) || {};
                return s.name || s.email || String(s.id || '-');
            },
        },
        {
            key: 'content',
            header: 'Message',
            render: (m: Message) => (m as any).content ? String((m as any).content).slice(0, 80) : '-',
        },
        { key: 'created_at', header: 'Created' },
        {
            key: 'actions',
            header: 'Actions',
            render: (m: Message) => (
                <div className="flex gap-2">
                    <Button onClick={() => handleSelect(m)}>View</Button>
                </div>
            ),
        },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Messages</h1>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4 flex gap-3 items-center">
                        <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <Button onClick={() => fetchMessages()}>Refresh</Button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="col-span-1">
                            <DataTable data={items} columns={columns} isLoading={loading} />
                        </div>
                    </div>
                </div>
            </div>

            <Drawer isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `Message #${selected.id}` : 'Message'}>
                {selected ? (
                    <div>
                        <div className="mb-4">
                            <div><strong>From:</strong> {(selected.sender as any)?.name || (selected.sender as any)?.email}</div>
                            <div className="mt-2 whitespace-pre-wrap bg-gray-50 p-3 rounded">{(selected as any).content}</div>
                        </div>

                        {/* Local conversation (replies only shown in the drawer) */}
                        <div className="mb-4">
                            <h3 className="font-medium">Conversation</h3>
                            <div className="mt-2 space-y-2">
                                {((localReplies as Record<number, Message[]>)[selected.id] || []).map((r) => (
                                    <div key={r.id} className="p-3 bg-white border rounded">
                                        <div className="text-xs text-gray-500">{(r.sender as any)?.name || 'You'} • {new Date(r.created_at).toLocaleString()}</div>
                                        <div className="whitespace-pre-wrap mt-1">{(r as any).content}</div>
                                    </div>
                                ))}
                                {(((localReplies as Record<number, Message[]>)[selected.id] || []).length === 0) && (
                                    <div className="text-sm text-gray-500">No replies yet</div>
                                )}
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="font-medium">Reply</h3>
                            <textarea value={reply} onChange={(e) => setReply(e.target.value)} className="w-full h-24 p-2 border rounded" />
                            <div className="mt-2 flex gap-2">
                                <Button onClick={handleReply} isLoading={sending} disabled={sending}>Send Reply</Button>
                                <Button onClick={handleClose} disabled={sending}>Close Case</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">No message selected</div>
                )}
            </Drawer>
        </Layout>
    );
}
