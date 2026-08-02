import React, { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;

type GatewayGroup = {
  group_id: string;
  group_name: string;
};

type CustomerMapping = {
  customer_id: number;
  company_name: string;
  group_id: string | null;
  group_name: string | null;
  is_enabled: boolean;
  show_prices: boolean;
  verified_at: string | null;
  updated_by: string | null;
};

export const WhatsAppSettings: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groups, setGroups] = useState<GatewayGroup[]>([]);
  const [mappings, setMappings] = useState<CustomerMapping[]>([]);
  const [settingsMeta, setSettingsMeta] = useState<any>({});
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState('UNKNOWN');
  const [gatewayUser, setGatewayUser] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(false);

  const labels = {
    title: isEn ? 'WhatsApp Automation Settings' : 'WhatsApp 自动发送设置',
    restricted: isEn
      ? 'This system shares the existing KIM LONG WhatsApp connection. Gateway credentials stay on the backend.'
      : '本系统共用现有 KIM LONG WhatsApp 连接；Gateway 凭证只保存在后端。',
    enabled: isEn ? 'Enable automatic delivery' : '启用自动发送',
    save: isEn ? 'Save Automation' : '保存自动发送',
    mappings: isEn ? 'Customer Group Mappings' : '顾客 WhatsApp 群组绑定',
    refreshGroups: isEn ? 'Load Live Groups' : '读取实时群组',
    customer: isEn ? 'Customer' : '顾客',
    targetGroup: isEn ? 'Approved Group' : '指定群组',
    auto: isEn ? 'Automatic' : '自动发送',
    prices: isEn ? 'Show Prices' : '显示金额',
    verification: isEn ? 'Verification' : '验证状态',
    actions: isEn ? 'Actions' : '操作',
    verified: isEn ? 'Verified' : '已验证',
    unverified: isEn ? 'Test required' : '需要测试',
    saveMapping: isEn ? 'Save Mapping' : '保存绑定',
    test: isEn ? 'Send Test' : '发送测试',
    reason: isEn ? 'Change Reason' : '修改原因',
    reasonHint: isEn ? 'Required for the audit log' : '必填，将记录到 Audit Log',
    pending: isEn ? 'Pending' : '等待发送',
    failed: isEn ? 'Failed' : '发送失败',
    qrTitle: isEn ? 'WhatsApp Login QR' : 'WhatsApp 登录 QR',
    qrRefresh: isEn ? 'Refresh QR' : '刷新 QR',
    qrHint: isEn ? 'Scan with WhatsApp Business under Linked devices. QR codes expire quickly.' : '请用 WhatsApp Business 的“已关联设备”扫描；QR 会很快过期。',
    qrEmpty: isEn ? 'Waiting for a login QR from the shared Gateway.' : '正在等待共用 Gateway 产生登录 QR。',
    connected: isEn ? 'Connected' : '已连接',
    disconnected: isEn ? 'Not connected' : '未连接',
  };

  const loadGateway = async (showError = true) => {
    setQrLoading(true);
    try {
      const statusResponse = await axiosInstance.get('/admin/whatsapp/status');
      const status = String(statusResponse.data?.status || 'UNKNOWN').toUpperCase();
      setGatewayStatus(status);
      setGatewayUser(statusResponse.data?.user || null);
      if (status === 'CONNECTED') {
        setQrImage(null);
      } else {
        const qrResponse = await axiosInstance.get('/admin/whatsapp/qr');
        const mimetype = qrResponse.data?.mimetype || 'image/png';
        const data = qrResponse.data?.data;
        setQrImage(data ? `data:${mimetype};base64,${data}` : null);
      }
    } catch (error: any) {
      setQrImage(null);
      if (showError) {
        message.error(error.response?.data?.detail || (isEn ? 'Failed to load WhatsApp connection' : '读取 WhatsApp 连接失败'));
      }
    } finally {
      setQrLoading(false);
    }
  };

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [settingsResponse, mappingsResponse] = await Promise.all([
        axiosInstance.get('/admin/whatsapp/settings'),
        axiosInstance.get('/admin/whatsapp/customer-mappings'),
      ]);
      const settings = settingsResponse.data || {};
      setSettingsMeta(settings);
      setMappings(mappingsResponse.data || []);
      setAutomationEnabled(Boolean(settings.is_enabled));
      if (settings.gateway_configured) void loadGateway(false);
    } catch (error: any) {
      message.error(error.response?.data?.detail || (isEn ? 'Failed to load WhatsApp settings' : '读取 WhatsApp 设置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
    const timer = window.setInterval(() => void loadGateway(false), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await axiosInstance.put('/admin/whatsapp/settings', { is_enabled: automationEnabled });
      setSettingsMeta(response.data || {});
      message.success(isEn ? 'WhatsApp automation saved' : 'WhatsApp 自动发送已保存');
    } catch (error: any) {
      message.error(error.response?.data?.detail || (isEn ? 'Failed to save settings' : '保存设置失败'));
    } finally {
      setSaving(false);
    }
  };

  const loadGroups = async () => {
    setGroupLoading(true);
    try {
      const response = await axiosInstance.get('/admin/whatsapp/groups');
      setGroups(response.data || []);
      message.success(isEn ? 'Live groups loaded' : '已读取实时群组清单');
    } catch (error: any) {
      message.error(error.response?.data?.detail || (isEn ? 'Failed to load groups' : '读取群组失败'));
    } finally {
      setGroupLoading(false);
    }
  };

  const updateMappingState = (customerId: number, changes: Partial<CustomerMapping>) => {
    setMappings((current) => current.map((row) => (
      row.customer_id === customerId ? { ...row, ...changes } : row
    )));
  };

  const saveMapping = (mapping: CustomerMapping) => {
    if (!mapping.group_id) {
      message.error(isEn ? 'Select a WhatsApp group first' : '请先选择 WhatsApp 群组');
      return;
    }
    let reason = '';
    Modal.confirm({
      title: `${labels.saveMapping} — ${mapping.company_name}`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder={labels.reasonHint}
          onChange={(event) => { reason = event.target.value; }}
        />
      ),
      okText: labels.saveMapping,
      cancelText: isEn ? 'Cancel' : '取消',
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(isEn ? 'Enter at least 3 characters' : '请输入至少3个字的原因');
          throw new Error('reason_required');
        }
        const selectedGroup = groups.find((group) => group.group_id === mapping.group_id);
        setRowBusy(mapping.customer_id);
        try {
          const response = await axiosInstance.put(`/admin/whatsapp/customer-mappings/${mapping.customer_id}`, {
            group_id: mapping.group_id,
            group_name: selectedGroup?.group_name || mapping.group_name || mapping.group_id,
            is_enabled: mapping.is_enabled,
            show_prices: mapping.show_prices,
            reason: reason.trim(),
          });
          const superseded = response.data?.superseded_pending_deliveries || 0;
          if (superseded > 0) {
            message.warning(isEn
              ? `Mapping saved. ${superseded} unsent task(s) were cancelled for safety; test the group, then resend those DOs from Order Status.`
              : `群组绑定已保存。为避免发到旧群，已取消 ${superseded} 个未发送任务；请先测试群组，再到订单状态重新发送有关 DO。`);
          } else {
            message.success(isEn ? 'Group mapping saved; send a test before use' : '群组绑定已保存；使用前请发送测试信息');
          }
          await loadBaseData();
        } catch (error: any) {
          message.error(error.response?.data?.detail || (isEn ? 'Failed to save mapping' : '保存群组绑定失败'));
          throw error;
        } finally {
          setRowBusy(null);
        }
      },
    });
  };

  const sendTest = async (mapping: CustomerMapping) => {
    setRowBusy(mapping.customer_id);
    try {
      await axiosInstance.post(`/admin/whatsapp/customer-mappings/${mapping.customer_id}/test`);
      message.success(isEn ? 'Test message sent' : '测试信息已发送');
      await loadBaseData();
    } catch (error: any) {
      message.error(error.response?.data?.detail || (isEn ? 'Test send failed' : '测试发送失败'));
    } finally {
      setRowBusy(null);
    }
  };

  const columns = [
    {
      title: labels.customer,
      dataIndex: 'company_name',
      key: 'company_name',
      width: 190,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: labels.targetGroup,
      key: 'group_id',
      width: 310,
      render: (_: unknown, row: CustomerMapping) => (
        <Select
          showSearch
          value={row.group_id || undefined}
          placeholder={isEn ? 'Load and select a live group' : '读取并选择实时群组'}
          optionFilterProp="label"
          style={{ width: '100%' }}
          options={groups.map((group) => ({
            value: group.group_id,
            label: `${group.group_name} (${group.group_id})`,
          }))}
          onChange={(groupId) => {
            const selected = groups.find((group) => group.group_id === groupId);
            updateMappingState(row.customer_id, {
              group_id: groupId,
              group_name: selected?.group_name || groupId,
              verified_at: groupId === row.group_id ? row.verified_at : null,
            });
          }}
        />
      ),
    },
    {
      title: labels.auto,
      key: 'is_enabled',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, row: CustomerMapping) => (
        <Switch
          checked={row.is_enabled}
          onChange={(checked) => updateMappingState(row.customer_id, { is_enabled: checked })}
        />
      ),
    },
    {
      title: labels.prices,
      key: 'show_prices',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, row: CustomerMapping) => (
        <Switch
          checked={row.show_prices}
          onChange={(checked) => updateMappingState(row.customer_id, { show_prices: checked })}
        />
      ),
    },
    {
      title: labels.verification,
      key: 'verified_at',
      width: 155,
      render: (_: unknown, row: CustomerMapping) => row.verified_at ? (
        <div>
          <Tag color="success" icon={<CheckCircleOutlined />}>{labels.verified}</Tag>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{row.updated_by || '-'}</Text></div>
        </div>
      ) : <Tag>{labels.unverified}</Tag>,
    },
    {
      title: labels.actions,
      key: 'actions',
      width: 205,
      fixed: 'right' as const,
      render: (_: unknown, row: CustomerMapping) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            loading={rowBusy === row.customer_id}
            onClick={() => saveMapping(row)}
          >
            {isEn ? 'Save' : '保存'}
          </Button>
          <Button
            size="small"
            icon={<SendOutlined />}
            disabled={!row.group_id || !row.is_enabled}
            loading={rowBusy === row.customer_id}
            onClick={() => sendTest(row)}
          >
            {labels.test}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}><WhatsAppOutlined /> {labels.title}</Title>
        <Text type="secondary">{labels.restricted}</Text>
      </div>

      <Alert
        type="info"
        showIcon
        message={isEn ? 'One automatic attempt, then manual send' : '自动尝试一次，失败后手动发送'}
        description={isEn
          ? 'Approval, DO changes, and cancellation each trigger one immediate WhatsApp attempt. There is no background retry. If it fails, staff use the WhatsApp button on Order Status.'
          : '批准、修改和取消 DO 时都会即时自动发送一次；系统不会在后台重复补发。如发送失败，员工到“订单状态”按该 DO 的 WhatsApp 按键手动发送。'}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card><Statistic title={labels.pending} value={settingsMeta.pending_count || 0} valueStyle={{ color: '#d97706' }} /></Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card><Statistic title={labels.failed} value={settingsMeta.failed_count || 0} valueStyle={{ color: '#dc2626' }} /></Card>
        </Col>
      </Row>

      <Card
        title={<Space><WhatsAppOutlined />{labels.qrTitle}</Space>}
        extra={<Button icon={<ReloadOutlined />} loading={qrLoading} onClick={() => loadGateway()}>{labels.qrRefresh}</Button>}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <Tag color={gatewayStatus === 'CONNECTED' ? 'success' : 'warning'} icon={gatewayStatus === 'CONNECTED' ? <CheckCircleOutlined /> : undefined}>
              {gatewayStatus === 'CONNECTED' ? labels.connected : `${labels.disconnected} (${gatewayStatus})`}
            </Tag>
            {gatewayUser && <Text type="secondary">{gatewayUser}</Text>}
          </div>
          {gatewayStatus === 'CONNECTED' ? (
            <Alert type="success" showIcon message={isEn ? 'The shared WhatsApp number is ready.' : '共用 WhatsApp 号码已连接，可以使用。'} />
          ) : qrImage ? (
            <img src={qrImage} alt={labels.qrTitle} style={{ width: 280, maxWidth: '100%', borderRadius: 8 }} />
          ) : (
            <Text type="secondary">{labels.qrEmpty}</Text>
          )}
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>{labels.qrHint}</Text>
          <Space style={{ marginTop: 16 }}>
            <Text>{labels.enabled}</Text>
            <Switch
              checked={automationEnabled}
              onChange={setAutomationEnabled}
              checkedChildren={isEn ? 'ON' : '启用'}
              unCheckedChildren={isEn ? 'OFF' : '停用'}
            />
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveSettings}>{labels.save}</Button>
          </Space>
        </div>
      </Card>

      <Card
        title={<Space><WhatsAppOutlined />{labels.mappings}</Space>}
        extra={(
          <Button icon={<ReloadOutlined />} loading={groupLoading} onClick={loadGroups}>{labels.refreshGroups}</Button>
        )}
      >
        <Table
          rowKey="customer_id"
          columns={columns}
          dataSource={mappings}
          loading={loading}
          pagination={{ pageSize: 12 }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </Space>
  );
};
