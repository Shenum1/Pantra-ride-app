export const Platform = {
  OS: 'node' as const,
  select: (obj: Record<string, unknown>) =>
    obj.default ?? obj.android ?? obj.ios ?? undefined,
};

export const Alert = { alert: () => {} };
export const Linking = { openURL: async () => {} };
