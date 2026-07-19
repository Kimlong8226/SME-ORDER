import type { ThemeConfig } from 'antd';

export const brightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#16a34a',     // 鲜嫩新鲜绿 Primary Green
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#0284c7',
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',    // 清爽亮灰底色
    colorText: '#0f172a',        // 高对比度黑字
    colorTextSecondary: '#475569',
  },
  components: {
    Button: {
      colorPrimary: '#16a34a',
    },
    Card: {
      boxShadowTertiary: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    },
    Table: {
      headerBg: '#f1f5f9',
      headerColor: '#334155',
    }
  }
};
