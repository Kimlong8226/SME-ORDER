import React, { Suspense, useState, useEffect } from 'react';
import { ConfigProvider, Layout, Menu, Button, Space, Typography, Tooltip, App as AntdApp, Result, Card, Spin } from 'antd';

import {
  CalendarOutlined, UsergroupAddOutlined, TeamOutlined, AppstoreOutlined,
  FormOutlined, GlobalOutlined, LogoutOutlined, DashboardOutlined,
  FileTextOutlined, UnorderedListOutlined, BookOutlined, OrderedListOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, WhatsAppOutlined, AuditOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './i18n';
import './index.css';
import { brightTheme } from './theme/themeConfig';
import { Login } from './pages/Login';
import { lazyWithReload } from './utils/lazyWithReload';
import { AdminOrderNotificationBell } from './components/AdminOrderNotificationBell';

const DashboardOverview = lazyWithReload('DashboardOverview', () => import('./pages/admin/DashboardOverview').then((module) => ({ default: module.DashboardOverview })));
const CustomerManagement = lazyWithReload('CustomerManagement', () => import('./pages/admin/CustomerManagement').then((module) => ({ default: module.CustomerManagement })));
const StaffManagement = lazyWithReload('StaffManagement', () => import('./pages/admin/StaffManagement').then((module) => ({ default: module.StaffManagement })));
const PackageManagement = lazyWithReload('PackageManagement', () => import('./pages/admin/PackageManagement').then((module) => ({ default: module.PackageManagement })));
const ClientMenuLibrary = lazyWithReload('ClientMenuLibrary', () => import('./pages/admin/ClientMenuLibrary').then((module) => ({ default: module.ClientMenuLibrary })));
const OrderCalendar = lazyWithReload('OrderCalendar', () => import('./pages/admin/OrderCalendar').then((module) => ({ default: module.OrderCalendar })));
const InvoiceManagement = lazyWithReload('InvoiceManagement', () => import('./pages/admin/InvoiceManagement').then((module) => ({ default: module.InvoiceManagement })));
const DailyOrderStatus = lazyWithReload('DailyOrderStatus', () => import('./pages/admin/DailyOrderStatus').then((module) => ({ default: module.DailyOrderStatus })));
const MatrixOrder = lazyWithReload('MatrixOrder', () => import('./pages/customer/MatrixOrder').then((module) => ({ default: module.MatrixOrder })));
const OrderHistory = lazyWithReload('OrderHistory', () => import('./pages/customer/WeeklyOrder').then((module) => ({ default: module.OrderHistory })));
const DeliveryOrders = lazyWithReload('DeliveryOrders', () => import('./pages/customer/DeliveryOrders').then((module) => ({ default: module.DeliveryOrders })));
const MealSectionsManagement = lazyWithReload('MealSectionsManagement', () => import('./pages/admin/MealSectionsManagement').then((module) => ({ default: module.MealSectionsManagement })));
const WhatsAppSettings = lazyWithReload('WhatsAppSettings', () => import('./pages/admin/WhatsAppSettings').then((module) => ({ default: module.WhatsAppSettings })));
const AuditLog = lazyWithReload('AuditLog', () => import('./pages/admin/AuditLog').then((module) => ({ default: module.AuditLog })));

const { Header, Content, Sider, Footer } = Layout;
const { Title } = Typography;

const PageLoading: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
    <Spin size="large" />
  </div>
);

class PageErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Page module failed to load', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="warning"
          title="系统页面已更新 / New version available"
          subTitle="页面资源加载失败，请刷新载入最新版本。 / Refresh to load the latest version."
          extra={<Button type="primary" onClick={() => window.location.reload()}>刷新页面 / Refresh</Button>}
        />
      );
    }

    return this.props.children;
  }
}

export const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      setCurrentUser(u);
      if (u.user_type === 'customer') {
        setActiveMenu('matrixOrder');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_info');
    setCurrentUser(null);
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('app_lang', nextLang);
  };

  if (!currentUser) {
    return (
      <ConfigProvider theme={brightTheme}>
        <AntdApp>
          <Login onLoginSuccess={(u) => {
            setCurrentUser(u);
            setActiveMenu(u.user_type === 'customer' ? 'matrixOrder' : 'dashboard');
          }} />
        </AntdApp>
      </ConfigProvider>
    );
  }

  const handleEditOrder = (order: any) => {
    localStorage.setItem('editing_order', JSON.stringify(order));
    setActiveMenu('matrixOrder');
  };

  const isAdmin = currentUser.user_type === 'staff';
  const isSuperadmin = currentUser.role === 'superadmin';

  const adminMenuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: t('nav.dashboard') },
    { key: 'orderStatus', icon: <UnorderedListOutlined />, label: t('nav.orderStatus') },
    { key: 'calendar', icon: <CalendarOutlined />, label: t('nav.calendar') },
    { key: 'customers', icon: <UsergroupAddOutlined />, label: t('nav.customers') },
    { key: 'packages', icon: <AppstoreOutlined />, label: t('nav.packages') },
    { key: 'clientMenuLibrary', icon: <BookOutlined />, label: t('nav.clientMenuLibrary') },
    { key: 'mealSections', icon: <OrderedListOutlined />, label: t('nav.mealSections') },
    { key: 'invoices', icon: <FileTextOutlined />, label: t('nav.invoices') },
    ...(isSuperadmin ? [{ key: 'staff', icon: <TeamOutlined />, label: t('nav.staff') }] : []),
    ...(isSuperadmin ? [{ key: 'whatsappSettings', icon: <WhatsAppOutlined />, label: t('nav.whatsappSettings') }] : []),
    ...(isSuperadmin ? [{ key: 'auditLog', icon: <AuditOutlined />, label: t('nav.auditLog') }] : []),
  ];

  const customerMenuItems = [
    { key: 'matrixOrder', icon: <FormOutlined />, label: t('nav.matrixOrder') },
    { key: 'orderHistory', icon: <UnorderedListOutlined />, label: t('nav.orderHistory') },
    { key: 'deliveryOrders', icon: <FileTextOutlined />, label: t('nav.deliveryOrders') },
  ];

  const menuItems = isAdmin ? adminMenuItems : customerMenuItems;

  return (
    <ConfigProvider theme={brightTheme}>
      <AntdApp>
      <Layout style={{ minHeight: '100vh', width: '100vw', background: '#f8fafc' }}>
        {/* 全宽 Header：品牌名称红色加粗，去掉龙 icon */}
        <Header style={{
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          height: 68,
          borderBottom: '1px solid #e2e8f0',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18, marginRight: 12, padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
            <img src="/logo.jpg" alt="Kim Long Catering Logo" style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: 6, marginRight: 10 }} />
            <Title level={3} style={{ margin: 0, color: '#dc2626', fontSize: 18, fontWeight: 900, letterSpacing: '0.5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {t('common.appName')}
            </Title>
          </div>

          <Space size="middle">
            {isAdmin && (
              <AdminOrderNotificationBell currentUser={currentUser} onNavigate={setActiveMenu} />
            )}
            <Tooltip title={i18n.language === 'zh' ? 'Switch to English' : '切换为中文'}>
              <Button
                icon={<GlobalOutlined />}
                onClick={toggleLanguage}
                type="text"
                shape="circle"
                size="large"
              />
            </Tooltip>

            <Tooltip title={t('common.logout')}>
              <Button
                icon={<LogoutOutlined />}
                danger
                type="text"
                shape="circle"
                size="large"
                onClick={handleLogout}
              />
            </Tooltip>
          </Space>
        </Header>

        <Layout style={{ width: '100%' }}>
          <Sider
            width={240}
            theme="light"
            breakpoint="lg"
            collapsedWidth="0"
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            trigger={null}
            style={{ borderRight: '1px solid #e2e8f0', background: '#ffffff', zIndex: 10 }}
          >
            <Menu
              mode="inline"
              selectedKeys={[activeMenu]}
              onClick={(e) => {
                setActiveMenu(e.key);
                if (window.innerWidth < 992) {
                  setCollapsed(true);
                }
              }}
              items={menuItems}
              style={{ height: '100%', borderRight: 0, paddingTop: 16, fontSize: 14 }}
            />
          </Sider>

          <Layout style={{ background: '#f8fafc' }}>
            <Content style={{ padding: '16px', minHeight: 'calc(100vh - 68px - 70px)', width: '100%' }}>
              <PageErrorBoundary key={activeMenu}>
              <Suspense fallback={<PageLoading />}>
                <div style={{ width: '100%' }}>
                {activeMenu === 'dashboard' && <DashboardOverview onNavigate={(key) => setActiveMenu(key)} />}
                {activeMenu === 'orderStatus' && <DailyOrderStatus />}
                {activeMenu === 'calendar' && <OrderCalendar />}
                {activeMenu === 'customers' && <CustomerManagement />}
                {activeMenu === 'packages' && <PackageManagement />}
                {activeMenu === 'clientMenuLibrary' && <ClientMenuLibrary />}
                {activeMenu === 'mealSections' && <MealSectionsManagement />}
                {activeMenu === 'invoices' && <InvoiceManagement />}
                {activeMenu === 'staff' && (
                  isSuperadmin ? <StaffManagement /> : (
                    <Card style={{ borderRadius: 12, marginTop: 24, textAlign: 'center' }}>
                      <Result
                        status="403"
                        title="403"
                        subTitle={i18n.language === 'en' ? 'Access Denied: Only Superadmin can access Staff Management.' : '权限不足：只有超级管理员 (superadmin) 才有权进入与管理员工后台。'}
                      />
                    </Card>
                  )
                )}
                {activeMenu === 'whatsappSettings' && (
                  isSuperadmin ? <WhatsAppSettings /> : (
                    <Result status="403" title="403" subTitle={i18n.language === 'en' ? 'Only superadmin can access WhatsApp settings.' : '只有最高权限者可以进入 WhatsApp 设置。'} />
                  )
                )}
                {activeMenu === 'auditLog' && (
                  isSuperadmin ? <AuditLog /> : (
                    <Result status="403" title="403" subTitle={i18n.language === 'en' ? 'Only superadmin can access the audit log.' : '只有最高权限者可以查看审计日志。'} />
                  )
                )}
                {activeMenu === 'matrixOrder' && <MatrixOrder />}

                {activeMenu === 'orderHistory' && <OrderHistory onEditOrder={handleEditOrder} />}
                {activeMenu === 'deliveryOrders' && <DeliveryOrders />}
                </div>
              </Suspense>
              </PageErrorBoundary>
            </Content>
            <Footer style={{ textAlign: 'left', color: '#64748b', fontSize: 11, background: 'transparent', padding: '16px 24px', letterSpacing: '0.5px' }}>
              COPY RIGHT by KIM LONG CATERING SDN BHD <br />
              REG: 202301025752 (1519675-T)
            </Footer>
          </Layout>
        </Layout>
      </Layout>
    </AntdApp>
    </ConfigProvider>
  );
};
