import React, { useCallback, useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

type MeResponse = {
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    createdAt: string;
    activeWorkspace: {
        id: string;
        title: string;
        createdAt: string;
        role: string;
    } | null;
};

type WorkspaceDto = {
    id: string;
    title: string;
    createdAt: string;
    role: string;
};

async function apiRequest<T>(params: { apiBaseUrl: string; userId: string; path: string; method?: string; body?: any }): Promise<T> {
    const resp = await fetch(`${params.apiBaseUrl}${params.path}`, {
        method: params.method ?? 'GET',
        headers: {
            'content-type': 'application/json',
            'x-user-id': params.userId,
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
    });

    const text = await resp.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }

    if (!resp.ok) {
        const message = typeof data?.message === 'string' ? data.message : 'Ошибка запроса';
        throw new Error(message);
    }

    return data as T;
}

function useTelegramTheme() {
    useEffect(() => {
        try {
            const scheme = WebApp.colorScheme;
            if (scheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch {
            // запуск вне Telegram — игнорируем
        }
    }, []);
}

const App: React.FC = () => {
    useTelegramTheme();

    const search = new URLSearchParams(window.location.search);
    const apiBaseUrl = (search.get('apiBaseUrl') || '').replace(/\/$/, '');
    const userId = search.get('userId') || '';

    const [path, setPath] = useState(window.location.pathname);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [me, setMe] = useState<MeResponse | null>(null);
    const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
    const [newTitle, setNewTitle] = useState('');

    const navigate = useCallback((nextPath: string) => {
        if (window.location.pathname !== nextPath) {
            window.history.replaceState(null, '', nextPath);
            setPath(nextPath);
        }
    }, []);

    const loadMe = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const meResp = await apiRequest<MeResponse>({
                apiBaseUrl,
                userId,
                path: '/me',
            });
            setMe(meResp);
            return meResp;
        } catch (e: any) {
            setError(e?.message || 'Неизвестная ошибка');
            return null;
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, userId]);

    const loadWorkspaces = useCallback(async () => {
        try {
            const ws = await apiRequest<WorkspaceDto[]>({
                apiBaseUrl,
                userId,
                path: '/workspaces',
            });
            setWorkspaces(ws);
            return ws;
        } catch (e: any) {
            setError(e?.message || 'Неизвестная ошибка');
            return [] as WorkspaceDto[];
        }
    }, [apiBaseUrl, userId]);

    useEffect(() => {
        if (!apiBaseUrl || !userId) {
            setError('Отсутствуют параметры подключения (userId или apiBaseUrl). Откройте Web App из бота.');
            setLoading(false);
            return;
        }

        void loadMe();
    }, [apiBaseUrl, userId, loadMe]);

    useEffect(() => {
        if (!me) return;

        if (path === '/') {
            if (me.activeWorkspace?.id) {
                navigate(`/workspaces/${me.activeWorkspace.id}`);
            } else {
                navigate('/workspaces');
            }
            return;
        }

        if (path === '/workspaces') {
            void loadWorkspaces();
            return;
        }

        if (path.startsWith('/workspaces/')) {
            const workspaceId = path.split('/')[2] || '';
            if (!me.activeWorkspace || me.activeWorkspace.id !== workspaceId) {
                navigate('/workspaces');
            }
            return;
        }

        navigate('/');
    }, [path, me, navigate, loadWorkspaces]);

    const handleSelect = useCallback(async (workspaceId: string) => {
        try {
            setLoading(true);
            setError(null);
            await apiRequest<WorkspaceDto>({
                apiBaseUrl,
                userId,
                path: `/workspaces/${workspaceId}/select`,
                method: 'POST',
            });

            const meResp = await loadMe();
            await loadWorkspaces();
            if (meResp?.activeWorkspace?.id) {
                navigate(`/workspaces/${meResp.activeWorkspace.id}`);
            } else {
                navigate('/workspaces');
            }
        } catch (e: any) {
            setError(e?.message || 'Не удалось выбрать рабочее пространство');
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, userId, loadMe, loadWorkspaces, navigate]);

    const handleCreate = useCallback(async () => {
        const title = newTitle.trim();
        if (!title) return;

        try {
            setLoading(true);
            setError(null);
            await apiRequest<WorkspaceDto>({
                apiBaseUrl,
                userId,
                path: '/workspaces',
                method: 'POST',
                body: { title },
            });

            setNewTitle('');
            const meResp = await loadMe();
            await loadWorkspaces();
            if (meResp?.activeWorkspace?.id) {
                navigate(`/workspaces/${meResp.activeWorkspace.id}`);
            }
        } catch (e: any) {
            setError(e?.message || 'Не удалось создать рабочее пространство');
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, userId, newTitle, loadMe, loadWorkspaces, navigate]);

    if (path === '/') {
        return null;
    }

    const isWorkspacesRoute = path === '/workspaces';
    const workspaceId = path.startsWith('/workspaces/') ? path.split('/')[2] || '' : '';
    const isWorkspaceHome = Boolean(workspaceId && me?.activeWorkspace?.id === workspaceId);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-2xl p-4">
                <h1 className="text-xl font-semibold">Рабочие пространства</h1>

                {loading && <div className="mt-2 text-sm">Загрузка...</div>}
                {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

                {isWorkspacesRoute && me && (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="text-sm font-medium">Ваши рабочие пространства</div>
                            {workspaces.length === 0 ? (
                                <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                    У вас пока нет рабочего пространства.
                                </div>
                            ) : (
                                <div className="mt-3 space-y-2 text-sm">
                                    {workspaces.map((ws) => (
                                        <button
                                            key={ws.id}
                                            onClick={() => handleSelect(ws.id)}
                                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                                        >
                                            <div>
                                                <div className="font-medium">{ws.title}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Роль: {ws.role}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="text-sm font-medium">Создать рабочее пространство</div>
                            <div className="mt-3 flex gap-2">
                                <input
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                                    placeholder="Название рабочего пространства"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                />
                                <button
                                    onClick={handleCreate}
                                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={!newTitle.trim() || loading}
                                >
                                    Создать
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isWorkspaceHome && me?.activeWorkspace && (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="text-sm font-medium">Главная рабочего пространства</div>
                            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                                <div>
                                    Рабочее пространство: <span className="font-medium">{me.activeWorkspace.title}</span>
                                </div>
                                <div className="mt-1">
                                    Роль: <span className="font-medium">{me.activeWorkspace.role}</span>
                                </div>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={() => navigate('/workspaces')}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                >
                                    Сменить рабочее пространство
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
