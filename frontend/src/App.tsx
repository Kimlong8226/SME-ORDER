import React, { useState, useEffect } from 'react';
import { App as AntdApp, ConfigProvider, Layout, Menu, Button, Space, Typography, Tooltip } from 'antd';
import {
  CalendarOutlined, UsergroupAddOutlined, TeamOutlined, AppstoreOutlined,
  FormOutlined, GlobalOutlined, LogoutOutlined, DashboardOutlined,
  FileTextOutlined, UnorderedListOutlined, BookOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './i18n';
import './index.css';
import { brightTheme } from './theme/themeConfig';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/admin/DashboardOverview';
import { CustomerManagement } from './pages/admin/CustomerManagement';
import { StaffManagement } from './pages/admin/StaffManagement';
import { PackageManagement } from './pages/admin/PackageManagement';
import { ClientMenuLibrary } from './pages/admin/ClientMenuLibrary';
import { OrderCalendar } from './pages/admin/OrderCalendar';
import { InvoiceManagement } from './pages/admin/InvoiceManagement';
import { DailyOrderStatus } from './pages/admin/DailyOrderStatus';
import { MatrixOrder } from './pages/customer/MatrixOrder';
import { OrderHistory } from './pages/customer/WeeklyOrder';
import { DeliveryOrders } from './pages/customer/DeliveryOrders';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

export const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');

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
    { key: 'invoices', icon: <FileTextOutlined />, label: t('nav.invoices') },
    ...(isSuperadmin ? [{ key: 'staff', icon: <TeamOutlined />, label: t('nav.staff') }] : []),
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
          padding: '0 32px',
          height: 68,
          borderBottom: '1px solid #e2e8f0',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0, color: '#dc2626', fontSize: 21, fontWeight: 900, letterSpacing: '0.5px' }}>
              {t('common.appName')}
            </Title>
          </div>

          <Space size="middle">
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
          <Sider width={240} theme="light" style={{ borderRight: '1px solid #e2e8f0', background: '#ffffff' }}>
            <Menu
              mode="inline"
              selectedKeys={[activeMenu]}
              onClick={(e) => setActiveMenu(e.key)}
              items={menuItems}
              style={{ height: '100%', borderRight: 0, paddingTop: 16, fontSize: 14 }}
            />
          </Sider>

          <Content style={{ padding: '24px 32px', background: '#f8fafc', minHeight: 'calc(100vh - 68px)', width: '100%' }}>
            <div style={{ width: '100%' }}>
              {activeMenu === 'dashboard' && <DashboardOverview onNavigate={(key) => setActiveMenu(key)} />}
              {activeMenu === 'orderStatus' && <DailyOrderStatus />}
              {activeMenu === 'calendar' && <OrderCalendar />}
              {activeMenu === 'customers' && <CustomerManagement />}
              {activeMenu === 'packages' && <PackageManagement />}
              {activeMenu === 'clientMenuLibrary' && <ClientMenuLibrary />}
              {activeMenu === 'invoices' && <InvoiceManagement />}
              {activeMenu === 'staff' && <StaffManagement />}
              {activeMenu === 'matrixOrder' && <MatrixOrder />}
              {activeMenu === 'orderHistory' && <OrderHistory onEditOrder={handleEditOrder} />}
              {activeMenu === 'deliveryOrders' && <DeliveryOrders />}
            </div>
          </Content>
        </Layout>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  );
};
