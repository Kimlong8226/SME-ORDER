import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Button, Alert, Tag } from 'antd';
import {
  CalendarOutlined, UsergroupAddOutlined, AppstoreOutlined, FileTextOutlined,
  WarningOutlined, ArrowUpOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface DashboardOverviewProps {
  onNavigate: (key: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Kim Long Central Kitchen System' : '金龙中央厨房伙食下单系统',
    subtitle: isEn ? 'KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM | Operation Hub' : 'KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM | 运营指挥中枢',
    currentDate: isEn ? 'Current Date: ' : '系统当前日期：',
    metricPortionsTitle: isEn ? "Today's Total Portions" : '今日预订配餐总数 (Portions)',
    portionsSuffix: isEn ? ' portions' : '份',
    metricOrdersCount: isEn ? "Today's Deliveries: " : '今日配送单数: ',
    ordersSuffix: isEn ? ' orders' : ' 笔',
    metricRevenueTitle: isEn ? 'Month Revenue' : '本月累计服务营业额 (RM)',
    metricRevenueDesc: isEn ? 'Auto-summed by agreement prices' : '按客户专属协议价自动汇总',
    metricClientsTitle: isEn ? 'Contracted Clients' : '签约企业客户数 (Clients)',
    clientsSuffix: isEn ? ' companies' : '家',
    metricClientsDesc: isEn ? 'Supports multi-factory delivery nodes' : '多工厂分送节点支持',
    metricBlockedTitle: isEn ? 'Credit Risk Blocked' : '风控冻结账号数 (Blocked)',
    metricBlockedDesc: isEn ? 'Outstanding payment block active' : '欠款自动拦截已生效',
    quickNavTitle: isEn ? 'Quick Management Hub' : '快捷管理中枢',
    btnDailyOrders: isEn ? 'Daily Orders Status' : '每日订单状态看板',
    btnCalendar: isEn ? 'Calendar & DO Slips' : '排单日历与送货单',
    btnCustomers: isEn ? 'Profiles & Freeze Switch' : '客户档案与冻结开关',
    btnPackages: isEn ? 'Custom Menus Database' : '顾客专属菜单',
    btnBilling: isEn ? 'Billing & Invoice Statement' : '客户账单',
    riskTitle: isEn ? 'Risk Control & Alerts' : '风控与提醒',
    alertBlockedTitle: isEn ? 'Payment Outstanding Block' : '欠款拦截提示',
    alertBlockedDesc: isEn ? 'If a client exceeds their billing terms, enable [Block Ordering] in profiles to block their submissions.' : '如客户逾期未结款，请在客户档案管理中开启【冻结下单】，系统将拦截其订餐员提报。',
    alertPrivacyTitle: isEn ? 'Price Confidentiality Mode' : '隐藏价格隐私保障',
    alertPrivacyDesc: isEn ? 'Ordering staff see no pricing or subtotal info to protect commercial secrets.' : '订餐员登录后完全看不到任何 RM 价格与小计，确保商业机密与隐私。',
  };

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/dashboard-stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatDate = () => {
    const locale = isEn ? 'en-US' : 'zh-CN';
    const options: Intl.DateTimeFormatOptions = isEn 
      ? { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }
      : { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' };
    return new Date().toLocaleDateString(locale, options);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 顶部 Banner */}
      <Card style={{
        background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
        borderRadius: 16,
        color: '#ffffff',
        marginBottom: 24,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
      }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} lg={18}>
            <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 900, fontSize: 'clamp(16px, 3.5vw, 24px)' }}>
              {isEn ? (
                <><span style={{ color: '#fef08a' }}>Kim Long</span> Central Kitchen System</>
              ) : (
                <><span style={{ color: '#fef08a' }}>金龙中央厨房</span>伙食下单系统</>
              )}
            </Title>
            <Text style={{ color: '#dcfce7', fontSize: 'clamp(11px, 2vw, 13px)', marginTop: 4, display: 'block' }}>
              {isEn ? 'KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM | Operation Hub' : '运营指挥中枢'}
            </Text>
          </Col>
          <Col xs={24} lg={6} style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px', fontWeight: 'bold' }}>
              {labels.currentDate} {formatDate()}
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* 核心指标统计卡片 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card loading={loading} style={{ borderRadius: 12 }}>
            <Statistic
              title={<Text type="secondary" strong>{labels.metricPortionsTitle}</Text>}
              value={stats?.today_portions || 0}
              suffix={labels.portionsSuffix}
              styles={{ content: { color: '#16a34a', fontWeight: 'bold', fontSize: 32 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              {labels.metricOrdersCount} {stats?.today_orders_count || 0} {labels.ordersSuffix}
            </Text>
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card loading={loading} style={{ borderRadius: 12 }}>
            <Statistic
              title={<Text type="secondary" strong>{labels.metricRevenueTitle}</Text>}
              value={stats?.month_revenue || 0}
              precision={2}
              prefix="RM"
              styles={{ content: { color: '#dc2626', fontWeight: 'bold', fontSize: 32 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              <ArrowUpOutlined style={{ color: '#16a34a' }} /> {labels.metricRevenueDesc}
            </Text>
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card loading={loading} style={{ borderRadius: 12 }}>
            <Statistic
              title={<Text type="secondary" strong>{labels.metricClientsTitle}</Text>}
              value={stats?.total_customers || 0}
              suffix={labels.clientsSuffix}
              styles={{ content: { color: '#0284c7', fontWeight: 'bold', fontSize: 32 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              {labels.metricClientsDesc}
            </Text>
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card loading={loading} style={{ borderRadius: 12 }}>
            <Statistic
              title={<Text type="secondary" strong>{labels.metricBlockedTitle}</Text>}
              value={stats?.blocked_customers || 0}
              suffix={labels.clientsSuffix}
              styles={{ content: { color: stats?.blocked_customers > 0 ? '#dc2626' : '#64748b', fontWeight: 'bold', fontSize: 32 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              {labels.metricBlockedDesc}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 快捷导航与运营风险预警 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card title={<Title level={4} style={{ margin: 0 }}>⚡ {labels.quickNavTitle}</Title>} style={{ borderRadius: 12 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Button type="primary" size="large" block icon={<UnorderedListOutlined />} onClick={() => onNavigate('orderStatus')} style={{ height: 'auto', minHeight: 60, whiteSpace: 'normal', fontSize: 15, fontWeight: 'bold', background: '#dc2626', borderColor: '#dc2626' }}>
                  {labels.btnDailyOrders}
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button type="primary" ghost size="large" block icon={<CalendarOutlined />} onClick={() => onNavigate('calendar')} style={{ height: 'auto', minHeight: 60, whiteSpace: 'normal', fontSize: 15, fontWeight: 'bold' }}>
                  {labels.btnCalendar}
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button type="primary" ghost size="large" block icon={<UsergroupAddOutlined />} onClick={() => onNavigate('customers')} style={{ height: 'auto', minHeight: 60, whiteSpace: 'normal', fontSize: 15, fontWeight: 'bold' }}>
                  {labels.btnCustomers}
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button type="primary" ghost size="large" block icon={<AppstoreOutlined />} onClick={() => onNavigate('packages')} style={{ height: 'auto', minHeight: 60, whiteSpace: 'normal', fontSize: 15, fontWeight: 'bold' }}>
                  {labels.btnPackages}
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button type="primary" ghost size="large" block icon={<FileTextOutlined />} onClick={() => onNavigate('invoices')} style={{ height: 'auto', minHeight: 60, whiteSpace: 'normal', fontSize: 15, fontWeight: 'bold' }}>
                  {labels.btnBilling}
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={24}>
          <Card title={<Title level={4} style={{ margin: 0 }}>{labels.riskTitle}</Title>} style={{ borderRadius: 12 }}>
            <Row gutter={[12, 12]}>
              <Col xs={12}>
                <Alert
                  message={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <strong style={{ fontSize: 13 }}>{labels.alertBlockedTitle}</strong>
                      <span style={{ fontSize: 11, lineHeight: 1.4, color: '#854d0e' }}>{labels.alertBlockedDesc}</span>
                    </div>
                  }
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ height: '100%', padding: '8px 10px', alignItems: 'flex-start' }}
                />
              </Col>
              <Col xs={12}>
                <Alert
                  message={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <strong style={{ fontSize: 13 }}>{labels.alertPrivacyTitle}</strong>
                      <span style={{ fontSize: 11, lineHeight: 1.4, color: '#0369a1' }}>{labels.alertPrivacyDesc}</span>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ height: '100%', padding: '8px 10px', alignItems: 'flex-start' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
