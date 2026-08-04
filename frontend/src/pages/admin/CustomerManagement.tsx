import React, { useEffect, useState } from 'react';
import { App, Table, Button, Modal, Form, Input, Select, Card, Tag, Space, Row, Col, Typography, Divider, Popconfirm, DatePicker } from 'antd';
import { PlusOutlined, EnvironmentOutlined, BankOutlined, SafetyCertificateOutlined, LockOutlined, UnlockOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';
import dayjs from 'dayjs';

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
    statusTemporary: isEn ? '🟠 Temporary Access' : '🟠 临时开放中',
    reasonRequired: isEn ? 'A reason of at least 3 characters is required.' : '必须填写至少 3 个字的操作原因。',
    reasonPlaceholder: isEn ? 'Enter the operational reason for audit...' : '请输入操作原因，内容将写入 Audit Log…',
    tempOpen: isEn ? 'Open 2 Days' : '临时开通2天',
    endTemporary: isEn ? 'End Temporary Access' : '结束临时权限',
    history: isEn ? 'Restriction History' : '冻结记录',
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
    editSiteTitle: isEn ? 'Edit Delivery Site / Factory' : '编辑送餐分点/工厂 (Edit Site)',
    formSiteName: isEn ? 'Site Name' : '分点/工厂名称',
    placeholderSiteName: isEn ? 'e.g. Tmn Tek Plant / Sinergy Branch' : '例如: tmn tek 工厂 / sinergy 分部',
    formSiteAddress: isEn ? 'Delivery Address' : '具体送餐地址',
    placeholderSiteAddress: isEn ? 'Detailed delivery street address' : '详细送餐门牌与街道地址',
    formSiteContact: isEn ? 'On-site Contact Person' : '现场接收负责人',
    formSitePhone: isEn ? 'On-site Phone' : '现场电话',
    editSiteSuccess: isEn ? 'Delivery site updated successfully' : '修改送餐点成功',
    deleteSiteSuccess: isEn ? 'Delivery site deleted' : '已成功删除送餐点',
    deleteSiteConfirm: isEn ? 'Are you sure you want to delete this delivery site?' : '确定要删除该送餐分点吗？',
  };

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  const [siteModalVisible, setSiteModalVisible] = useState(false);
  const [currentCustomerId, setCurrentCustomerId] = useState<number | null>(null);
  const [editingSite, setEditingSite] = useState<any | null>(null);

  const [form] = Form.useForm();
  const [siteForm] = Form.useForm();
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyCustomer, setHistoryCustomer] = useState<any | null>(null);
  const [cutoffVisible, setCutoffVisible] = useState(false);
  const [cutoffCustomer, setCutoffCustomer] = useState<any | null>(null);
  const [cutoffOverrides, setCutoffOverrides] = useState<any[]>([]);
  const [cutoffForm] = Form.useForm();
  const [overrideForm] = Form.useForm();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/customers');
      const sortedData = (res.data || []).sort((a: any, b: any) => 
        (a.company_name || '').localeCompare(b.company_name || '')
      );
      setCustomers(sortedData);
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

  const handleAccessAction = (customer: any, action: 'block' | 'unblock' | 'temporary_open' | 'end_temporary') => {
    let reason = '';
    const titles: Record<string, string> = {
      block: labels.freezeConfirmTitle,
      unblock: labels.unfreezeConfirmTitle,
      temporary_open: labels.tempOpen,
      end_temporary: labels.endTemporary,
    };
    Modal.confirm({
      title: `${titles[action]} — ${customer.company_name}`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder={labels.reasonPlaceholder}
          onChange={(event) => { reason = event.target.value; }}
        />
      ),
      okText: titles[action],
      okType: action === 'block' || action === 'end_temporary' ? 'danger' : 'primary',
      cancelText: labels.btnCancel,
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(labels.reasonRequired);
          throw new Error('reason_required');
        }
        try {
          await axiosInstance.put(`/admin/customers/${customer.id}/order-access`, {
            action,
            reason: reason.trim(),
          });
          message.success(action === 'block' ? labels.freezeSuccess : labels.unfreezeSuccess);
          await fetchCustomers();
        } catch (err: any) {
          if (err.message === 'reason_required') throw err;
          message.error(err.response?.data?.detail || labels.toggleFailed);
          throw err;
        }
      },
    });
  };

  const handleOpenHistory = async (customer: any) => {
    try {
      const res = await axiosInstance.get(`/admin/customers/${customer.id}/restriction-history`);
      setHistoryCustomer(customer);
      setHistoryRecords(res.data || []);
      setHistoryVisible(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.loadFailed);
    }
  };

  const handleOpenAddSite = (customerId: number) => {
    setCurrentCustomerId(customerId);
    setEditingSite(null);
    siteForm.resetFields();
    setSiteModalVisible(true);
  };

  const handleOpenEditSite = (site: any) => {
    setEditingSite(site);
    siteForm.setFieldsValue(site);
    setSiteModalVisible(true);
  };

  const handleDeleteSite = async (siteId: number) => {
    try {
      await axiosInstance.delete(`/admin/customers/sites/${siteId}`);
      message.success(labels.deleteSiteSuccess);
      fetchCustomers();
    } catch (err) {
      message.error(isEn ? 'Failed to delete site' : '删除送餐点失败');
    }
  };

  const handleSaveSite = async (values: any) => {
    try {
      if (editingSite) {
        await axiosInstance.put(`/admin/customers/sites/${editingSite.id}`, values);
        message.success(labels.editSiteSuccess);
      } else {
        if (!currentCustomerId) return;
        await axiosInstance.post(`/admin/customers/${currentCustomerId}/sites`, values);
        message.success(labels.addSiteSuccess);
      }
      setSiteModalVisible(false);
      siteForm.resetFields();
      setEditingSite(null);
      fetchCustomers();
    } catch (err) {
      message.error(labels.addSiteFailed);
    }
  };

  const openCutoffSettings = async (customer: any) => {
    setCutoffCustomer(customer);
    cutoffForm.setFieldsValue({
      day_offset: customer.order_cutoff_day_offset ?? 1,
      cutoff_time: customer.order_cutoff_time || '18:00',
      reason: '',
    });
    overrideForm.resetFields();
    setCutoffVisible(true);
    try {
      const res = await axiosInstance.get(`/admin/customers/${customer.id}/cutoff-overrides`);
      setCutoffOverrides(res.data || []);
    } catch {
      setCutoffOverrides([]);
    }
  };

  const saveDefaultCutoff = async (values: any) => {
    if (!cutoffCustomer) return;
    try {
      await axiosInstance.put(`/admin/customers/${cutoffCustomer.id}/cutoff-settings`, values);
      message.success(isEn ? 'Default cutoff rule updated' : '客户默认下单截止规则已更新');
      await fetchCustomers();
    } catch (err: any) {
      message.error(err.response?.data?.detail || (isEn ? 'Failed to update cutoff rule' : '更新截止规则失败'));
    }
  };

  const saveCutoffOverride = async (values: any) => {
    if (!cutoffCustomer) return;
    const deliveryDate = values.delivery_date.format('YYYY-MM-DD');
    const cutoffAt = `${values.cutoff_date.format('YYYY-MM-DD')}T${values.cutoff_time}:00+08:00`;
    try {
      await axiosInstance.put(`/admin/customers/${cutoffCustomer.id}/cutoff-overrides/${deliveryDate}`, {
        cutoff_at: cutoffAt,
        reason: values.reason,
      });
      message.success(isEn ? 'Manual cutoff saved' : '指定配送日期的截止时间已设置');
      overrideForm.resetFields();
      const res = await axiosInstance.get(`/admin/customers/${cutoffCustomer.id}/cutoff-overrides`);
      setCutoffOverrides(res.data || []);
    } catch (err: any) {
      message.error(err.response?.data?.detail || (isEn ? 'Failed to save manual cutoff' : '保存手动截止时间失败'));
    }
  };

  const cancelCutoffOverride = async (record: any) => {
    if (!cutoffCustomer) return;
    let reason = '';
    Modal.confirm({
      title: isEn ? 'Restore customer default cutoff?' : '恢复客户默认截止规则？',
      content: <Input.TextArea rows={3} placeholder={labels.reasonPlaceholder} onChange={(e) => { reason = e.target.value; }} />,
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(labels.reasonRequired);
          throw new Error('reason_required');
        }
        await axiosInstance.delete(`/admin/customers/${cutoffCustomer.id}/cutoff-overrides/${record.delivery_date}`, { params: { reason: reason.trim() } });
        setCutoffOverrides((items) => items.filter((item) => item.id !== record.id));
        message.success(isEn ? 'Customer default cutoff restored' : '已恢复客户默认截止规则');
      },
    });
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
        <Space orientation="vertical" size={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {record.sites && record.sites.map((s: any) => (
            <Tag 
              color="blue" 
              key={s.id} 
              icon={<EnvironmentOutlined />}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 12, margin: '2px 0' }}
            >
              <span>{s.site_name} ({s.address})</span>
              <Space size={4} style={{ marginLeft: 6 }}>
                <EditOutlined 
                  title="修改此分点" 
                  style={{ cursor: 'pointer', color: '#1890ff', fontSize: 13 }} 
                  onClick={(e) => { e.stopPropagation(); handleOpenEditSite(s); }} 
                />
                <Popconfirm
                  title={labels.deleteSiteConfirm}
                  onConfirm={() => handleDeleteSite(s.id)}
                  okText={isEn ? 'Delete' : '删除'}
                  cancelText={labels.btnCancel}
                >
                  <DeleteOutlined 
                    title="删除此分点" 
                    style={{ cursor: 'pointer', color: '#ff4d4f', fontSize: 13 }} 
                    onClick={(e) => e.stopPropagation()} 
                  />
                </Popconfirm>
              </Space>
            </Tag>
          ))}
          <Button 
            type="dashed" 
            size="small" 
            icon={<PlusOutlined />} 
            onClick={() => handleOpenAddSite(record.id)}
            style={{ borderRadius: 12, marginTop: 2 }}
          >
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
        record.temporary_access_active ? (
          <div>
            <Tag color="warning" style={{ fontSize: 13, padding: '2px 8px' }}>{labels.statusTemporary}</Tag>
            <div><Text type="secondary" style={{ fontSize: 11 }}>{record.temporary_access_until}</Text></div>
          </div>
        ) : record.effective_is_blocked ? (
          <Tag color="error" style={{ fontSize: 13, padding: '2px 8px' }}>{labels.statusSuspended}</Tag>
        ) : (
          <Tag color="success" style={{ fontSize: 13, padding: '2px 8px' }}>{labels.statusActive}</Tag>
        )
      ),
    },
    {
      title: isEn ? 'Order Cutoff' : '最后下单时间',
      key: 'order_cutoff',
      render: (record: any) => (
        <div>
          <Tag color={record.order_cutoff_day_offset === 0 ? 'purple' : 'blue'}>
            {record.order_cutoff_day_offset === 0
              ? (isEn ? 'Delivery day' : '配送当天')
              : (isEn ? 'Previous day' : '配送前一天')} {record.order_cutoff_time || '18:00'}
          </Tag>
          <div><Button type="link" size="small" onClick={() => openCutoffSettings(record)}>{isEn ? 'Manage' : '后台设置'}</Button></div>
        </div>
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

          {record.temporary_access_active ? (
            <Button size="small" danger icon={<ClockCircleOutlined />} onClick={() => handleAccessAction(record, 'end_temporary')}>
              {labels.endTemporary}
            </Button>
          ) : record.effective_is_blocked ? (
            <>
              <Button size="small" type="primary" icon={<ClockCircleOutlined />} onClick={() => handleAccessAction(record, 'temporary_open')}>
                {labels.tempOpen}
              </Button>
              <Button size="small" icon={<UnlockOutlined />} onClick={() => handleAccessAction(record, 'unblock')}>
                {labels.btnActivate}
              </Button>
            </>
          ) : (
            <Button size="small" danger type="primary" icon={<LockOutlined />} onClick={() => handleAccessAction(record, 'block')}>
              {labels.btnSuspend}
            </Button>
          )}
          <Button size="small" icon={<HistoryOutlined />} onClick={() => handleOpenHistory(record)}>{labels.history}</Button>
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

      <Modal
        title={`${labels.history}${historyCustomer ? ` — ${historyCustomer.company_name}` : ''}`}
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={<Button onClick={() => setHistoryVisible(false)}>{labels.btnCancel}</Button>}
        width={760}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={historyRecords}
          columns={[
            { title: isEn ? 'Time' : '时间', dataIndex: 'created_at', width: 165 },
            { title: isEn ? 'Action' : '操作', dataIndex: 'action_type', width: 190, render: (value: string) => <Tag>{value}</Tag> },
            { title: isEn ? 'Operator' : '操作人', dataIndex: 'operator_name', width: 140 },
            { title: isEn ? 'Reason' : '原因', dataIndex: 'reason', width: 180, render: (value: string) => value || '-' },
            { title: isEn ? 'Details' : '说明', dataIndex: 'description' },
          ]}
        />
      </Modal>

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

      <Modal
        title={`${isEn ? 'Order Cutoff Settings' : '下单截止时间设置'}${cutoffCustomer ? ` — ${cutoffCustomer.company_name}` : ''}`}
        open={cutoffVisible}
        onCancel={() => setCutoffVisible(false)}
        footer={<Button onClick={() => setCutoffVisible(false)}>{labels.btnCancel}</Button>}
        width={780}
      >
        <Card size="small" title={isEn ? 'Customer default rule' : '客户长期默认规则'}>
          <Text type="secondary">{isEn ? 'Only staff can change this rule. New customers default to 6:00 PM on the previous day.' : '只有后台员工可以修改。新客户默认配送前一天18:00截止。'}</Text>
          <Form form={cutoffForm} layout="vertical" onFinish={saveDefaultCutoff} style={{ marginTop: 12 }}>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="day_offset" label={isEn ? 'Cutoff day' : '截止日期'} rules={[{ required: true }]}>
                  <Select options={[{ value: 1, label: isEn ? 'Previous day' : '配送前一天' }, { value: 0, label: isEn ? 'Delivery day' : '配送当天' }]} />
                </Form.Item>
              </Col>
              <Col span={8}><Form.Item name="cutoff_time" label={isEn ? 'Cutoff time' : '截止时间'} rules={[{ required: true }]}><Input type="time" /></Form.Item></Col>
              <Col span={8}><Form.Item name="reason" label={isEn ? 'Reason' : '修改原因'} rules={[{ required: true, min: 3 }]}><Input /></Form.Item></Col>
            </Row>
            <Button type="primary" htmlType="submit">{isEn ? 'Save default rule' : '保存默认规则'}</Button>
          </Form>
        </Card>

        <Card size="small" title={isEn ? 'Manual cutoff for one delivery date' : '指定配送日期手动设置'} style={{ marginTop: 16 }}>
          <Form form={overrideForm} layout="vertical" onFinish={saveCutoffOverride}>
            <Row gutter={12}>
              <Col span={8}><Form.Item name="delivery_date" label={isEn ? 'Delivery date' : '配送日期'} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
              <Col span={8}><Form.Item name="cutoff_date" label={isEn ? 'Allow ordering until date' : '允许下单至日期'} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
              <Col span={8}><Form.Item name="cutoff_time" label={isEn ? 'Allow ordering until time' : '允许下单至时间'} rules={[{ required: true }]}><Input type="time" /></Form.Item></Col>
            </Row>
            <Form.Item name="reason" label={isEn ? 'Reason' : '开放原因'} rules={[{ required: true, min: 3 }]}><Input.TextArea rows={2} /></Form.Item>
            <Button type="primary" htmlType="submit">{isEn ? 'Set manual cutoff' : '设置手动截止时间'}</Button>
          </Form>
          <Divider />
          <Table size="small" rowKey="id" pagination={false} dataSource={cutoffOverrides} columns={[
            { title: isEn ? 'Delivery date' : '配送日期', dataIndex: 'delivery_date' },
            { title: isEn ? 'Manual cutoff' : '手动截止时间', dataIndex: 'cutoff_at', render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
            { title: isEn ? 'Reason' : '原因', dataIndex: 'reason' },
            { title: isEn ? 'Operator' : '操作人', dataIndex: 'updated_by' },
            { title: '', render: (record: any) => <Button danger size="small" onClick={() => cancelCutoffOverride(record)}>{isEn ? 'Cancel override' : '取消手动设置'}</Button> },
          ]} />
        </Card>
      </Modal>

      {/* 新增/编辑送餐地点 Modal */}
      <Modal
        title={editingSite ? labels.editSiteTitle : labels.modalSiteTitle}
        open={siteModalVisible}
        onCancel={() => { setSiteModalVisible(false); setEditingSite(null); }}
        onOk={() => siteForm.submit()}
      >
        <Form form={siteForm} layout="vertical" onFinish={handleSaveSite}>
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
