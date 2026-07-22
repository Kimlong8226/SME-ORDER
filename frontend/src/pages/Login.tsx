import React, { useState } from 'react';
import { Card, Form, Input, Button, App, Space, Tag, Typography, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../api/axiosInstance';

const { Title, Text } = Typography;

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isEn = i18n.language === 'en';

  const labels = {
    brandBullet1: isEn ? 'Custom corporate agreed pricing & precise multi-site distribution' : '企业专属协议价与多厂区精准分送',
    brandBullet2: isEn ? 'Fast order entry with streamlined reporting workflows' : '订餐人员极速报数，极简安全提报流程',
    brandBullet3: isEn ? 'Daily catering list export & smart credit billing cycle management' : '每日配餐清单导出与智能信用账期管理',
    copyright: isEn ? '© 2026 Kim Long Catering. All Rights Reserved.' : '© 2026 金龙中央厨房 版权所有',
    welcomeLogin: isEn ? 'Welcome Login' : '欢迎登录',
    superadmin: isEn ? 'Superadmin (Administrator)' : 'Superadmin (超级管理员)',
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('app_lang', nextLang);
  };

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/login', values);
      const data = res.data;
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_info', JSON.stringify(data));
      message.success(`${t('common.login')} ${t('common.success')}`);
      onLoginSuccess(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || t('common.error');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (u: string, p: string) => {
    form.setFieldsValue({ username: u, password: p });
  };

  const [form] = Form.useForm();

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 1080,
          borderRadius: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Row style={{ minHeight: 'auto' }}>
          {/* 左侧：品牌展示 */}
          <Col xs={24} sm={24} md={11} lg={11} style={{
            background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
            color: '#ffffff',
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <img src="/logo.jpg" alt="Kim Long Catering Logo" style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 8, background: '#ffffff', padding: 2 }} />
                <Title level={2} style={{ color: '#ffffff', margin: 0, fontSize: 24, fontWeight: 900 }}>{t('common.appName')}</Title>
              </div>
              <Text style={{ color: '#dcfce7', fontSize: 13, display: 'block', fontWeight: 600 }}>
                KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM
              </Text>

              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#86efac' }} />
                  <Text style={{ color: '#ffffff', fontSize: 14 }}>{labels.brandBullet1}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#86efac' }} />
                  <Text style={{ color: '#ffffff', fontSize: 14 }}>{labels.brandBullet2}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#86efac' }} />
                  <Text style={{ color: '#ffffff', fontSize: 14 }}>{labels.brandBullet3}</Text>
                </div>
              </div>
            </div>

            <Text style={{ color: '#bbf7d0', fontSize: 12, marginTop: 40 }}>
              {labels.copyright}
            </Text>
          </Col>

          {/* 右侧：登录表单 */}
          <Col xs={24} sm={24} md={13} lg={13} style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={3} style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>{labels.welcomeLogin}</Title>
              <Button icon={<GlobalOutlined />} onClick={toggleLanguage} size="middle">
                {i18n.language === 'zh' ? 'EN' : '中'}
              </Button>
            </div>

            <Form form={form} layout="vertical" onFinish={handleLogin}>
              <Form.Item name="username" label={<Text strong style={{ fontSize: 14 }}>{t('common.username')}</Text>} rules={[{ required: true }]}>
                <Input prefix={<UserOutlined />} placeholder="Username" size="large" style={{ height: 44, borderRadius: 8 }} />
              </Form.Item>
              <Form.Item name="password" label={<Text strong style={{ fontSize: 14 }}>{t('common.password')}</Text>} rules={[{ required: true }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" style={{ height: 44, borderRadius: 8 }} />
              </Form.Item>

              <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ height: 44, borderRadius: 8, marginTop: 12, fontSize: 16, fontWeight: 600 }}>
                {t('common.login')}
              </Button>
            </Form>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <Space wrap size={[8, 8]}>
                <Tag color="green" style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }} onClick={() => fillAccount('admin', 'admin123')}>
                  {labels.superadmin}
                </Tag>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};
