import React, { useEffect, useState } from 'react';
import { App, Table, Button, Modal, Form, Input, Select, Card, Tag, Space, Row, Col, Typography, Divider, Popconfirm } from 'antd';
import { PlusOutlined, EnvironmentOutlined, BankOutlined, SafetyCertificateOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;

export const CustomerManagement: React.FC = () => {
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Customer Profiles Management' : '客户档案管理',
    subtitle: isEn ? '(Includes Order Suspend Toggle)' : '(包含客户下单冻结开关)',
    btnCreate: isEn ? 'Create New Customer' : '创建新客户',
    loadFailed: isEn ? 'Failed to fetch customer list' : '获取客户列表失败',
    saveSuccess: isEn ? 'Customer profile updated successfully' : '客户资料更新成功',
    createSuccess: isEn ? 'Customer created successfully' : '客户创建成功',
    saveFailed: isEn ? 'Failed to save customer details' : '保存失败',
    freezeSuccess: isEn ? 'Successfully suspended ordering permission!' : '已成功【冻结】客户的下单权限！',
    unfreezeSuccess: isEn ? 'Successfully activated customer ordering permission!' : '已成功【解除冻结】客户！',
    toggleFailed: isEn ? 'Failed to update order permission status' : '冻结操作失败',
    addSiteSuccess: isEn ? 'Delivery site added successfully' : '新增送餐点成功',
    addSiteFailed: isEn ? 'Failed to add delivery site' : '新增送餐点失败',
    colContact: isEn ? 'Contact Person & Phone' : '负责人 & 联系电话',
    colBankTax: isEn ? 'Bank & Tax Info' : '银行与税号信息',
    noBank: isEn ? 'No Bank Info' : '未设银行',
    taxNoLabel: isEn ? 'Tax No: ' : '税号: ',
    daysCycle: isEn ? 'Days Cycle' : '天一结',
    colStatus: isEn ? 'Ordering Status' : '下单权限状态',
    statusSuspended: isEn ? '🚫 Suspended' : '🚫 下单已冻结 (Suspended)',
    statusActive: isEn ? '🟢 Active' : '🟢 下单正常 (Active)',
    unfreezeConfirmTitle: isEn ? 'Lift Suspension Confirmation' : '解除冻结确认',
    unfreezeConfirmDesc: isEn ? 'Are you sure you want to lift the suspension for this customer? Staff will be able to order again.' : '确定要【解除冻结】该客户的下单权限吗？解除后订餐员可恢复下单。',
    btnConfirmUnfreeze: isEn ? 'Confirm Lift' : '确认解封',
    btnCancel: isEn ? 'Cancel' : '取消',
    btnActivate: isEn ? 'Activate' : '解封客户',
    freezeConfirmTitle: isEn ? 'Suspend Ordering Confirmation' : '冻结下单权限确认',
    freezeConfirmDesc: isEn ? 'Are you sure you want to suspend ordering for this customer? Staff submissions will be blocked.' : '确定要【冻结拦截】该客户的下单权限吗？冻结后该客户订餐员将无法下单。',
    btnConfirmFreeze: isEn ? 'Confirm Suspend' : '确认冻结',
    btnSuspend: isEn ? 'Suspend' : '冻结下单',
    modalEditTitle: isEn ? 'Edit Customer Profile' : '编辑客户档案',
    modalCreateTitle: isEn ? 'Create Customer Profile (Superadmin)' : '创建新客户档案 (Superadmin)',
    formUsername: isEn ? 'Initial Staff Username' : '初始订餐员登录账号',
    formPassword: isEn ? 'Initial Password' : '初始登录密码',
    dividerBilling: isEn ? 'Billing & Bank Details' : '财务对账资料',
    placeholderRegNo: isEn ? 'e.g. 20240100987' : '例如: 20240100987',
    placeholderUsername: isEn ? 'Staff login username' : '订餐员登录用户名',
    placeholderContact: isEn ? 'e.g. Manager Chen' : '例如: 陈经理',
    placeholderBankAcct: isEn ? 'Bank Account No.' : '银行账号',
    placeholderTaxNo: isEn ? 'Company Tax Number' : '公司税号',
    placeholderAddress: isEn ? 'Company legal registration or billing address' : '公司法定注册或发票账单地址',
    modalSiteTitle: isEn ? 'Add Delivery Site / Factory' : '新增送餐分点/工厂 (Delivery Site)',
    formSiteName: isEn ? 'Site Name' : '分点/工厂名称',
    placeholderSiteName: isEn ? 'e.g. Tmn Tek Plant / Sinergy Branch' : '例如: tmn tek 工厂 / sinergy 分部',
    formSiteAddress: isEn ? 'Delivery Address' : '具体送餐地址',
    placeholderSiteAddress: isEn ? 'Detailed delivery street address' : '详细送餐门牌与街道地址',
    formSiteContact: isEn ? 'On-site Contact Person' : '现场接收负责人',
    formSitePhone: isEn ? 'On-site Phone' : '现场电话',
  };

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  const [siteModalVisible, setSiteModalVisible] = useState(false);
  const [currentCustomerId, setCurrentCustomerId] = useState<number | null>(null);

  const [form] = Form.useForm();
  const [siteForm] = Form.useForm();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/customers');
      setCustomers(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (customer?: any) => {
    setEditingCustomer(customer || null);
    if (customer) {
      form.setFieldsValue(customer);
    } else {
      form.resetFields();
      form.setFieldsValue({ billing_cycle: '30', is_blocked: false });
    }
    setModalVisible(true);
  };

  const handleSaveCustomer = async (values: any) => {
    try {
      if (editingCustomer) {
        await axiosInstance.put(`/admin/customers/${editingCustomer.id}`, values);
        message.success(labels.saveSuccess);
      } else {
        await axiosInstance.post('/admin/customers', values);
        message.success(labels.createSuccess);
      }
      setModalVisible(false);
      fetchCustomers();
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.saveFailed);
    }
  };

  const handleToggleFreezeCustomer = async (customer: any) => {
    const nextBlockedState = !customer.is_blocked;
    try {
      await axiosInstance.put(`/admin/customers/${customer.id}`, {
        ...customer,
        is_blocked: nextBlockedState
      });
      if (nextBlockedState) {
        message.warning(`${labels.freezeSuccess} [${customer.company_name}]`);
      } else {
        message.success(`${labels.unfreezeSuccess} [${customer.company_name}]`);
      }
      fetchCustomers();
    } catch (err) {
      message.error(labels.toggleFailed);
    }
  };

  const handleAddSite = async (values: any) => {
    if (!currentCustomerId) return;
    try {
      await axiosInstance.post(`/admin/customers/${currentCustomerId}/sites`, values);
      message.success(labels.addSiteSuccess);
      setSiteModalVisible(false);
      siteForm.resetFields();
      fetchCustomers();
    } catch (err) {
      message.error(labels.addSiteFailed);
    }
  };

  const columns = [
    {
      title: t('customer.companyName'),
      dataIndex: 'company_name',
      key: 'company_name',
      render: (text: string, record: any) => (
        <div>
          <Text strong style={{ fontSize: 15 }}>{text}</Text>
          {record.company_reg_no && <div><Text type="secondary" style={{ fontSize: 12 }}>Reg: {record.company_reg_no}</Text></div>}
        </div>
      ),
    },
    {
      title: labels.colContact,
      key: 'contact',
      render: (record: any) => (
        <div>
          <div>{record.contact_name || '-'}</div>
          <Text type="secondary">{record.phone || '-'}</Text>
        </div>
      ),
    },
    {
      title: labels.colBankTax,
      key: 'bank_tax',
      render: (record: any) => (
        <div style={{ fontSize: 12 }}>
          <div><BankOutlined /> {record.bank_name || labels.noBank}: {record.bank_account_no || '-'}</div>
          <div><SafetyCertificateOutlined /> {labels.taxNoLabel}{record.tax_number || '-'}</div>
        </div>
      ),
    },
    {
      title: t('customer.sites'),
      key: 'sites',
      render: (record: any) => (
        <Space orientation="vertical" size={2}>
          {record.sites && record.sites.map((s: any) => (
            <Tag color="blue" key={s.id} icon={<EnvironmentOutlined />}>
              {s.site_name} ({s.address})
            </Tag>
          ))}
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => { setCurrentCustomerId(record.id); setSiteModalVisible(true); }}>
            {t('customer.addSite')}
          </Button>
        </Space>
      ),
    },
    {
      title: t('customer.billingCycle'),
      dataIndex: 'billing_cycle',
      key: 'billing_cycle',
      render: (val: string) => <Tag color="orange">{val} {labels.daysCycle}</Tag>,
    },
    {
      title: labels.colStatus,
      key: 'is_blocked',
      render: (record: any) => (
        record.is_blocked ? (
          <Tag color="error" style={{ fontSize: 13, padding: '2px 8px' }}>{labels.statusSuspended}</Tag>
        ) : (
          <Tag color="success" style={{ fontSize: 13, padding: '2px 8px' }}>{labels.statusActive}</Tag>
        )
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (record: any) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => handleOpenModal(record)}>
            {t('common.edit')}
          </Button>

          {record.is_blocked ? (
            <Popconfirm
              title={labels.unfreezeConfirmTitle}
              description={labels.unfreezeConfirmDesc}
              onConfirm={() => handleToggleFreezeCustomer(record)}
              okText={labels.btnConfirmUnfreeze}
              cancelText={labels.btnCancel}
            >
              <Button size="small" type="primary" icon={<UnlockOutlined />} style={{ background: '#22c55e', borderColor: '#22c55e' }}>
                {labels.btnActivate}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={labels.freezeConfirmTitle}
              description={labels.freezeConfirmDesc}
              onConfirm={() => handleToggleFreezeCustomer(record)}
              okText={labels.btnConfirmFreeze}
              cancelText={labels.btnCancel}
            >
              <Button size="small" danger type="primary" icon={<LockOutlined />}>
                {labels.btnSuspend}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('nav.customers')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          {labels.btnCreate}
        </Button>
      </div>
      <Table columns={columns} dataSource={customers} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />

      {/* 创建/编辑客户 Modal */}
      <Modal
        title={editingCustomer ? labels.modalEditTitle : labels.modalCreateTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveCustomer}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_name" label={t('customer.companyName')} rules={[{ required: true }]}>
                <Input placeholder="e.g. GSP Group" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company_reg_no" label={t('customer.regNo')}>
                <Input placeholder={labels.placeholderRegNo} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label={labels.formUsername} rules={[{ required: true }]}>
                <Input placeholder={labels.placeholderUsername} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label={editingCustomer ? "修改登录密码 (留空则不修改)" : labels.formPassword} rules={[{ required: !editingCustomer }]}>
                <Input.Password placeholder="Password" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_name" label={t('customer.contact')}>
                <Input placeholder={labels.placeholderContact} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('customer.phone')}>
                <Input placeholder="+60 12-345 6789" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label={t('customer.email')}>
                <Input placeholder="finance@company.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="billing_cycle" label={t('customer.billingCycle')}>
                <Select>
                  <Option value="7">7 {isEn ? 'Days Cycle' : '天一结'}</Option>
                  <Option value="14">14 {isEn ? 'Days Cycle' : '天一结'}</Option>
                  <Option value="30">30 {isEn ? 'Days Cycle' : '天一结'}</Option>
                  <Option value="45">45 {isEn ? 'Days Cycle' : '天一结'}</Option>
                  <Option value="60">60 {isEn ? 'Days Cycle' : '天一结'}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }}>{labels.dividerBilling}</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bank_name" label={t('customer.bankName')}>
                <Input placeholder="Maybank / CIMB" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_account_no" label={t('customer.bankAccount')}>
                <Input placeholder={labels.placeholderBankAcct} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tax_number" label={t('customer.taxNo')}>
                <Input placeholder={labels.placeholderTaxNo} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="company_address" label={t('customer.address')}>
            <Input.TextArea rows={2} placeholder={labels.placeholderAddress} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增送餐地点 Modal */}
      <Modal
        title={labels.modalSiteTitle}
        open={siteModalVisible}
        onCancel={() => setSiteModalVisible(false)}
        onOk={() => siteForm.submit()}
      >
        <Form form={siteForm} layout="vertical" onFinish={handleAddSite}>
          <Form.Item name="site_name" label={labels.formSiteName} rules={[{ required: true }]}>
            <Input placeholder={labels.placeholderSiteName} />
          </Form.Item>
          <Form.Item name="address" label={labels.formSiteAddress} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder={labels.placeholderSiteAddress} />
          </Form.Item>
          <Form.Item name="contact_person" label={labels.formSiteContact}>
            <Input placeholder={labels.formSiteContact} />
          </Form.Item>
          <Form.Item name="phone" label={labels.formSitePhone}>
            <Input placeholder="Phone" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
