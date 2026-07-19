import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Modal, Form, InputNumber, Select, message,
  Tag, Typography, Space, Popconfirm, Badge, Alert, Switch, Tooltip, Tabs
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined,
  LockOutlined, UnlockOutlined, BookOutlined, StopOutlined,
  PlusSquareOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;

export const ClientMenuLibrary: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  // NOTE: 所有文案集中在此，方便后续语言切换维护
  const labels = {
    pageTitle: isEn ? '📖 Client Menu Library' : '📖 顾客专属菜单管理库 (Client Menu Library)',
    currentCustomer: isEn ? 'Managing Customer: ' : '当前管理顾客：',
    // ── 套餐 Tab ──
    tabPackages: isEn ? '🍱 Packages' : '🍱 套餐',
    btnAddPkgToClient: isEn ? '+ Add Package to Customer Menu' : '+ 添加套餐至该顾客菜单库',
    colAssignedName: isEn ? 'Package Name' : '专属套餐名称',
    colCategory: isEn ? 'Category' : '分类',
    colAgreementPrice: isEn ? 'Agreement Price (RM)' : '客户专属协议价 (RM)',
    colStatus: isEn ? 'Status' : '状态控制',
    colAction: isEn ? 'Actions' : '菜单库操作',
    statusActive: isEn ? 'Active' : '已启用',
    btnEditPrice: isEn ? 'Edit Price' : '改协议价',
    btnDelete: isEn ? 'Delete' : '删除',
    statusTagSuspended: isEn ? '🚫 Suspended' : '🚫 已冻结',
    statusTagActive: isEn ? '🟢 Active' : '🟢 正常',
    btnSuspend: isEn ? 'Suspend Ordering' : '一键冻结下单',
    btnActivate: isEn ? 'Lift Suspension' : '解除冻结',
    freezeConfirmTitle: isEn ? 'Suspend Ordering Confirmation' : '冻结下单确认',
    freezeConfirmDesc: isEn
      ? 'Are you sure you want to suspend ordering for this customer? They will not be able to order.'
      : '确认【冻结】该客户的下单权限吗？对方将无法继续提交订单。',
    unfreezeConfirmTitle: isEn ? 'Lift Suspension Confirmation' : '解封确认',
    unfreezeConfirmDesc: isEn
      ? 'Are you sure you want to lift ordering suspension for this customer?'
      : '确认【解封】该客户的下单权限吗？',
    confirmDeletePkg: isEn
      ? "Are you sure you want to remove this package from the customer's menu library?"
      : '确定要从该顾客专属菜单库中删除此套餐吗？',
    modalAssignTitle: isEn ? 'Add Package to Customer Library' : '添加套餐至顾客菜单库',
    formSelectPkg: isEn ? 'Select Package to Assign' : '选择要授予该顾客的套餐',
    placeholderSelectPkg: isEn ? 'Select Package' : '选择套餐',
    formSetAgreementPrice: isEn ? 'Set Agreement Unit Price for Client (RM)' : '设定针对该顾客的专属协议单价 (RM)',
    placeholderSetPrice: isEn ? 'Set Price (RM)' : '设定协议价格 (RM)',
    modalPriceTitle: isEn ? 'Edit Agreement Price' : '修改协议单价',
    formUpdatePrice: isEn ? 'Update Agreement Price (RM)' : '更新专属协议单价 (RM)',
    btnSave: isEn ? 'Save' : '确定',
    btnCancel: isEn ? 'Cancel' : '取消',
    assignSuccess: isEn ? 'Package added to customer menu successfully!' : '已成功将套餐加入该客户的专属菜单库！',
    assignFailed: isEn ? 'Failed to assign package' : '指派套餐失败',
    priceSuccess: isEn ? 'Agreement price updated successfully!' : '协议单价更新成功！',
    priceFailed: isEn ? 'Failed to update price' : '更新价格失败',
    deleteSuccess: isEn ? 'Package removed successfully!' : '已成功删除该套餐！',
    deleteFailed: isEn ? 'Failed to remove package' : '删除套餐失败',
    freezeSuccess: isEn ? 'Ordering suspended' : '已冻结的下单权限',
    unfreezeSuccess: isEn ? 'Ordering restored' : '已恢复的下单权限',
    toggleFailed: isEn ? 'Failed to update status' : '状态修改失败',
    loadCustsFailed: isEn ? 'Failed to fetch customer list' : '获取客户失败',
    loadAssignedFailed: isEn ? 'Failed to fetch assigned packages' : '获取指派套餐失败',
    loadPkgsFailed: isEn ? 'Failed to fetch package templates' : '获取套餐列表失败',
    blockedWarning: isEn
      ? 'This customer is currently SUSPENDED. They cannot place orders.'
      : '该客户目前已被【冻结】，无法提交订单。',
    emptyMenuHint: isEn
      ? 'No packages assigned yet. Click "Add Package" to get started.'
      : '该客户目前没有专属套餐，点击「添加套餐」开始配置。',
    colVisible: isEn ? 'Show on Order Page' : '在下单页显示',
    switchOnTip: isEn ? 'Showing on order page. Click to hide.' : '已显示在下单页。点击屏蔽',
    switchOffTip: isEn ? 'Hidden from order page. Click to show.' : '已从下单页隐藏。点击开启',
    toggleSuccess: isEn ? 'Display status updated!' : '显示状态已更新！',
    toggleFailed2: isEn ? 'Failed to toggle display status' : '更新显示状态失败',

    // ── Add-on Tab ──
    tabAddons: isEn ? '🥚 Add-ons' : '🥚 Add-on 单点',
    btnAddAddonToClient: isEn ? '+ Assign Add-on to Customer' : '+ 分配 Add-on 给该客户',
    colAddonName: isEn ? 'Add-on Name' : 'Add-on 名称',
    colAddonDesc: isEn ? 'Description' : '描述',
    colAddonDefaultPrice: isEn ? 'Pool Default Price' : '池默认价',
    colAddonAgreementPrice: isEn ? 'Customer Agreement Price (RM)' : '客户协议价 (RM)',
    colAddonAction: isEn ? 'Actions' : '操作',
    modalAssignAddonTitle: isEn ? 'Assign Add-on to Customer' : '分配 Add-on 给该顾客',
    formSelectAddon: isEn ? 'Select Add-on' : '选择 Add-on',
    placeholderSelectAddon: isEn ? 'Select Add-on' : '选择 Add-on 项目',
    formAddonAgreementPrice: isEn ? 'Customer Agreement Price (RM)' : '该顾客的 Add-on 协议价 (RM)',
    modalAddonPriceTitle: isEn ? 'Edit Add-on Agreement Price' : '修改 Add-on 协议价',
    confirmDeleteAddon: isEn
      ? 'Remove this Add-on from the customer menu?'
      : '确定要从该顾客菜单库中移除此 Add-on 吗？',
    addonAssignSuccess: isEn ? 'Add-on assigned successfully!' : 'Add-on 分配成功！',
    addonAssignFailed: isEn ? 'Failed to assign Add-on' : '分配 Add-on 失败',
    addonPriceSuccess: isEn ? 'Add-on agreement price updated!' : 'Add-on 协议价更新成功！',
    addonPriceFailed: isEn ? 'Failed to update Add-on price' : '更新 Add-on 协议价失败',
    addonDeleteSuccess: isEn ? 'Add-on removed from customer menu!' : '已从该客户菜单库中移除 Add-on！',
    addonDeleteFailed: isEn ? 'Failed to remove Add-on' : '移除 Add-on 失败',
    loadAddonsFailed: isEn ? 'Failed to fetch Add-ons' : '获取 Add-on 失败',
    emptyAddonHint: isEn
      ? 'No Add-ons assigned. Click "Assign Add-on" to configure.'
      : '该客户暂未分配任何 Add-on，点击「分配 Add-on」开始配置。',
  };

  const translateCategory = (cat: string) => {
    if (!isEn) return cat;
    const map: Record<string, string> = {
      '饭盒': 'Bento Box',
      '大型供餐': 'Bulk Meals',
      'Buffet': 'Buffet Meal',
      'Buffet 自助餐': 'Buffet Meal',
      '宵夜': 'Supper',
    };
    return map[cat] || cat;
  };

  const translatePkgName = (name: string) => {
    if (!isEn) return name;
    if (name.includes('饭盒') && name.includes('2菜1肉')) return 'Bento Box (2 Veg 1 Meat 1 Fruit)';
    if (name.includes('日式饭盒')) return 'Japanese Bento Box';
    if (name.includes('Buffet 自助餐')) return 'Buffet Meal';
    return name;
  };

  // ── 套餐 State ──
  const [packages, setPackages] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [assignedPackages, setAssignedPackages] = useState<any[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editPriceModalVisible, setEditPriceModalVisible] = useState(false);
  const [editingAssignedPkg, setEditingAssignedPkg] = useState<any | null>(null);
  const [assignForm] = Form.useForm();
  const [priceForm] = Form.useForm();

  // ── Add-on State ──
  const [allAddons, setAllAddons] = useState<any[]>([]);          // 全局 Add-on 池
  const [assignedAddons, setAssignedAddons] = useState<any[]>([]); // 该客户已分配
  const [addonAssignModalVisible, setAddonAssignModalVisible] = useState(false);
  const [addonPriceModalVisible, setAddonPriceModalVisible] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any | null>(null);
  const [addonAssignForm] = Form.useForm();
  const [addonPriceForm] = Form.useForm();

  // ── 获取数据 ──
  const fetchPackages = async () => {
    try {
      const res = await axiosInstance.get('/admin/packages');
      setPackages(res.data || []);
    } catch {
      message.error(labels.loadPkgsFailed);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axiosInstance.get('/admin/customers');
      setCustomers(res.data || []);
      // NOTE: 默认选中第一个客户
      if (res.data && res.data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(res.data[0].id);
      }
    } catch {
      message.error(labels.loadCustsFailed);
    }
  };

  const fetchAssignedPackages = async (cid: number) => {
    try {
      const res = await axiosInstance.get(`/admin/customers/${cid}/packages`);
      setAssignedPackages(res.data || []);
    } catch {
      message.error(labels.loadAssignedFailed);
    }
  };

  /** 获取全局 Add-on 池（用于指派选择器） */
  const fetchAllAddons = async () => {
    try {
      const res = await axiosInstance.get('/admin/addons');
      setAllAddons(res.data || []);
    } catch {
      message.error(labels.loadAddonsFailed);
    }
  };

  /** 获取该客户已分配的 Add-on */
  const fetchAssignedAddons = async (cid: number) => {
    try {
      const res = await axiosInstance.get(`/admin/customers/${cid}/addons`);
      setAssignedAddons(res.data || []);
    } catch {
      message.error(labels.loadAddonsFailed);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchCustomers();
    fetchAllAddons();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchAssignedPackages(selectedCustomerId);
      fetchAssignedAddons(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const currentCustomerObj = customers.find(c => c.id === selectedCustomerId);

  // ── 套餐操作 ──
  const handleAssignPackage = async (values: any) => {
    if (!selectedCustomerId) return;
    try {
      await axiosInstance.post(`/admin/customers/${selectedCustomerId}/packages`, values);
      message.success(labels.assignSuccess);
      setAssignModalVisible(false);
      assignForm.resetFields();
      fetchAssignedPackages(selectedCustomerId);
    } catch {
      message.error(labels.assignFailed);
    }
  };

  const handleOpenEditPrice = (record: any) => {
    setEditingAssignedPkg(record);
    priceForm.setFieldsValue({ agreement_price: record.agreement_price });
    setEditPriceModalVisible(true);
  };

  const handleUpdatePrice = async (values: any) => {
    if (!editingAssignedPkg) return;
    try {
      await axiosInstance.post(`/admin/customers/${editingAssignedPkg.customer_id}/packages`, {
        package_template_id: editingAssignedPkg.package_template_id,
        agreement_price: values.agreement_price,
      });
      message.success(labels.priceSuccess);
      setEditPriceModalVisible(false);
      fetchAssignedPackages(editingAssignedPkg.customer_id);
    } catch {
      message.error(labels.priceFailed);
    }
  };

  const handleDeleteCustomerPackage = async (record: any) => {
    try {
      await axiosInstance.delete(`/admin/customers/${record.customer_id}/packages/${record.id}`);
      message.success(labels.deleteSuccess);
      fetchAssignedPackages(record.customer_id);
    } catch {
      message.error(labels.deleteFailed);
    }
  };

  const handleToggleFreeze = async (customer: any) => {
    const nextState = !customer.is_blocked;
    try {
      await axiosInstance.put(`/admin/customers/${customer.id}`, { ...customer, is_blocked: nextState });
      message.info(
        nextState
          ? `${labels.freezeSuccess} [${customer.company_name}]`
          : `${labels.unfreezeSuccess} [${customer.company_name}]`
      );
      fetchCustomers();
    } catch {
      message.error(labels.toggleFailed);
    }
  };

  /**
   * 切换该套餐在顾客下单页的显示状态
   * 调用 PATCH toggle-visibility 接口，后端反转 is_shown_to_customer
   */
  const handleToggleVisibility = async (record: any) => {
    try {
      await axiosInstance.patch(
        `/admin/customers/${record.customer_id}/packages/${record.id}/toggle-visibility`
      );
      message.success(
        record.is_shown_to_customer ? labels.switchOffTip : labels.switchOnTip
      );
      fetchAssignedPackages(record.customer_id);
    } catch {
      message.error(labels.toggleFailed2);
    }
  };

  // ── Add-on 操作 ──
  /**
   * 将 Add-on 分配给当前选中客户，并设定协议价
   */
  const handleAssignAddon = async (values: any) => {
    if (!selectedCustomerId) return;
    try {
      await axiosInstance.post(`/admin/customers/${selectedCustomerId}/addons`, values);
      message.success(labels.addonAssignSuccess);
      setAddonAssignModalVisible(false);
      addonAssignForm.resetFields();
      fetchAssignedAddons(selectedCustomerId);
    } catch {
      message.error(labels.addonAssignFailed);
    }
  };

  const handleOpenEditAddonPrice = (record: any) => {
    setEditingAddon(record);
    addonPriceForm.setFieldsValue({ agreement_price: record.agreement_price });
    setAddonPriceModalVisible(true);
  };

  const handleUpdateAddonPrice = async (values: any) => {
    if (!editingAddon || !selectedCustomerId) return;
    try {
      await axiosInstance.put(
        `/admin/customers/${selectedCustomerId}/addons/${editingAddon.id}`,
        { agreement_price: values.agreement_price }
      );
      message.success(labels.addonPriceSuccess);
      setAddonPriceModalVisible(false);
      fetchAssignedAddons(selectedCustomerId);
    } catch {
      message.error(labels.addonPriceFailed);
    }
  };

  const handleDeleteCustomerAddon = async (record: any) => {
    try {
      await axiosInstance.delete(
        `/admin/customers/${record.customer_id}/addons/${record.id}`
      );
      message.success(labels.addonDeleteSuccess);
      fetchAssignedAddons(record.customer_id);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || labels.addonDeleteFailed;
      message.error(errMsg);
    }
  };

  // ── 表格列：套餐 ──
  const assignedColumns = [
    {
      title: labels.colAssignedName,
      dataIndex: 'template_name',
      key: 'template_name',
      render: (text: string) => (
        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
          {translatePkgName(text)}
        </Text>
      ),
    },
    {
      title: labels.colCategory,
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (val: string) => <Tag color="blue">{translateCategory(val)}</Tag>,
    },
    {
      title: labels.colAgreementPrice,
      dataIndex: 'agreement_price',
      key: 'agreement_price',
      width: 180,
      render: (val: number) => (
        <Tag color="gold" style={{ fontSize: 15, padding: '2px 12px', fontWeight: 'bold' }}>
          RM {val.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: labels.colVisible,
      key: 'is_shown_to_customer',
      dataIndex: 'is_shown_to_customer',
      width: 160,
      render: (val: boolean, record: any) => (
        <Tooltip title={val ? labels.switchOnTip : labels.switchOffTip}>
          <Space size={8}>
            <Switch
              checked={val}
              onChange={() => handleToggleVisibility(record)}
              checkedChildren={<EyeOutlined />}
              unCheckedChildren={<EyeInvisibleOutlined />}
              style={{
                background: val ? '#16a34a' : '#94a3b8'
              }}
            />
            <span style={{
              fontSize: 12,
              color: val ? '#16a34a' : '#94a3b8',
              fontWeight: 600
            }}>
              {val ? (<><EyeOutlined style={{ marginRight: 3 }} />显示中</>) : (<><EyeInvisibleOutlined style={{ marginRight: 3 }} />已隐藏</>)}
            </span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 160,
      render: (record: any) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleOpenEditPrice(record)}>
            {labels.btnEditPrice}
          </Button>
          <Popconfirm
            title={labels.confirmDeletePkg}
            onConfirm={() => handleDeleteCustomerPackage(record)}
            okText={labels.btnSave}
            cancelText={labels.btnCancel}
          >
            <Button size="small" type="link" danger>
              {labels.btnDelete}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── 表格列：Add-on ──
  const addonColumns = [
    {
      title: labels.colAddonName,
      dataIndex: 'addon_name',
      key: 'addon_name',
      render: (text: string) => (
        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
          {text}
        </Text>
      ),
    },
    {
      title: labels.colAddonDesc,
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {val || '—'}
        </Text>
      ),
    },
    {
      title: labels.colAddonDefaultPrice,
      dataIndex: 'default_price',
      key: 'default_price',
      width: 140,
      render: (val: number) => (
        <Text type="secondary">RM {val?.toFixed(2) ?? '—'}</Text>
      ),
    },
    {
      title: labels.colAddonAgreementPrice,
      dataIndex: 'agreement_price',
      key: 'agreement_price',
      width: 200,
      render: (val: number) => (
        <Tag color="orange" style={{ fontSize: 15, padding: '2px 12px', fontWeight: 'bold' }}>
          RM {val.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: labels.colAddonAction,
      key: 'actions',
      width: 160,
      render: (record: any) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditAddonPrice(record)}
          >
            {labels.btnEditPrice}
          </Button>
          <Popconfirm
            title={labels.confirmDeleteAddon}
            onConfirm={() => handleDeleteCustomerAddon(record)}
            okText={labels.btnSave}
            cancelText={labels.btnCancel}
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              {labels.btnDelete}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── 顾客选择 + 冻结控制栏（共用于两个 Tab） ──
  const renderCustomerControlBar = () => (
    <div
      style={{
        marginBottom: 20,
        padding: '14px 20px',
        background: currentCustomerObj?.is_blocked ? '#fef2f2' : '#f0f7ff',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: currentCustomerObj?.is_blocked ? '1.5px solid #fca5a5' : '1.5px solid #bfdbfe',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* 左侧：顾客选择器 */}
      <Space size="middle" align="center">
        <Text strong style={{ fontSize: 15 }}>
          {labels.currentCustomer}
        </Text>
        <Select
          style={{ minWidth: 280 }}
          size="large"
          value={selectedCustomerId}
          onChange={(val) => setSelectedCustomerId(val)}
        >
          {customers.map((c) => (
            <Option key={c.id} value={c.id}>
              <Space>
                <Badge status={c.is_blocked ? 'error' : 'success'} />
                {c.company_name}
                <Tag
                  color={c.is_blocked ? 'error' : 'success'}
                  style={{ fontSize: 11, marginLeft: 2 }}
                >
                  {c.is_blocked ? labels.statusTagSuspended : labels.statusTagActive}
                </Tag>
              </Space>
            </Option>
          ))}
        </Select>
      </Space>

      {/* 右侧：冻结/解封 按钮 */}
      {currentCustomerObj && (
        <Space size="middle">
          {currentCustomerObj.is_blocked ? (
            <Popconfirm
              title={labels.unfreezeConfirmTitle}
              description={`${labels.unfreezeConfirmDesc} [${currentCustomerObj.company_name}]`}
              onConfirm={() => handleToggleFreeze(currentCustomerObj)}
              okText={labels.btnActivate}
              cancelText={labels.btnCancel}
            >
              <Button
                type="primary"
                icon={<UnlockOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                {labels.btnActivate}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={labels.freezeConfirmTitle}
              description={`${labels.freezeConfirmDesc} [${currentCustomerObj.company_name}]`}
              onConfirm={() => handleToggleFreeze(currentCustomerObj)}
              okText={labels.btnSuspend}
              cancelText={labels.btnCancel}
            >
              <Button danger type="primary" icon={<LockOutlined />}>
                {labels.btnSuspend}
              </Button>
            </Popconfirm>
          )}
        </Space>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题栏 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <BookOutlined style={{ fontSize: 26, color: '#2563eb' }} />
        <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
          {labels.pageTitle}
        </Title>
      </div>

      <Card
        style={{ borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        {/* 顾客选择 + 冻结控制栏 */}
        {renderCustomerControlBar()}

        {/* 冻结提示横幅 */}
        {currentCustomerObj?.is_blocked && (
          <Alert
            message={labels.blockedWarning}
            type="error"
            showIcon
            icon={<StopOutlined />}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {/* ── Tabs：套餐 / Add-on ── */}
        <Tabs
          defaultActiveKey="packages"
          type="card"
          tabBarExtraContent={{
            right: (
              <Space>
                {/* 动态根据当前 Tab 显示对应添加按钮 */}
              </Space>
            ),
          }}
          items={[
            {
              key: 'packages',
              label: labels.tabPackages,
              children: (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setAssignModalVisible(true)}
                      disabled={!selectedCustomerId || currentCustomerObj?.is_blocked}
                      style={{ background: '#2563eb', borderColor: '#2563eb' }}
                    >
                      {labels.btnAddPkgToClient}
                    </Button>
                  </div>
                  <Table
                    columns={assignedColumns}
                    dataSource={assignedPackages}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    locale={{ emptyText: labels.emptyMenuHint }}
                    style={{ width: '100%' }}
                    rowClassName={() => 'menu-row'}
                  />
                </>
              ),
            },
            {
              key: 'addons',
              label: labels.tabAddons,
              children: (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button
                      type="primary"
                      icon={<PlusSquareOutlined />}
                      onClick={() => setAddonAssignModalVisible(true)}
                      disabled={!selectedCustomerId || currentCustomerObj?.is_blocked}
                      style={{ background: '#ea580c', borderColor: '#ea580c' }}
                    >
                      {labels.btnAddAddonToClient}
                    </Button>
                  </div>
                  <Table
                    columns={addonColumns}
                    dataSource={assignedAddons}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    locale={{ emptyText: labels.emptyAddonHint }}
                    style={{ width: '100%' }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* ── 套餐 Modals ── */}
      <Modal
        title={`${labels.modalAssignTitle} — ${currentCustomerObj?.company_name || ''}`}
        open={assignModalVisible}
        onCancel={() => { setAssignModalVisible(false); assignForm.resetFields(); }}
        onOk={() => assignForm.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={600}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignPackage}>
          <Form.Item
            name="package_template_id"
            label={labels.formSelectPkg}
            rules={[{ required: true }]}
          >
            <Select placeholder={labels.placeholderSelectPkg} size="large">
              {packages.map((p) => (
                <Option key={p.id} value={p.id}>
                  {translatePkgName(p.name)} ({translateCategory(p.category)}) —{' '}
                  {isEn ? 'Default: ' : '默认单价 '}RM {p.default_price.toFixed(2)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="agreement_price"
            label={labels.formSetAgreementPrice}
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              precision={2}
              placeholder={labels.placeholderSetPrice}
              size="large"
              prefix="RM"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${labels.modalPriceTitle} — ${translatePkgName(editingAssignedPkg?.template_name || '')}`}
        open={editPriceModalVisible}
        onCancel={() => setEditPriceModalVisible(false)}
        onOk={() => priceForm.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={480}
      >
        <Form form={priceForm} layout="vertical" onFinish={handleUpdatePrice}>
          <Form.Item
            name="agreement_price"
            label={labels.formUpdatePrice}
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: '100%' }} precision={2} size="large" prefix="RM" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Add-on Modals ── */}
      <Modal
        title={`${labels.modalAssignAddonTitle} — ${currentCustomerObj?.company_name || ''}`}
        open={addonAssignModalVisible}
        onCancel={() => { setAddonAssignModalVisible(false); addonAssignForm.resetFields(); }}
        onOk={() => addonAssignForm.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={580}
      >
        <Form form={addonAssignForm} layout="vertical" onFinish={handleAssignAddon}>
          <Form.Item
            name="addon_template_id"
            label={labels.formSelectAddon}
            rules={[{ required: true }]}
          >
            <Select placeholder={labels.placeholderSelectAddon} size="large">
              {allAddons.map((a) => (
                <Option key={a.id} value={a.id}>
                  {a.name}
                  {a.description ? ` — ${a.description}` : ''}
                  {' '}（{isEn ? 'Default: ' : '默认 '}RM {a.default_price.toFixed(2)}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="agreement_price"
            label={labels.formAddonAgreementPrice}
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              precision={2}
              size="large"
              prefix="RM"
              min={0}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${labels.modalAddonPriceTitle} — ${editingAddon?.addon_name || ''}`}
        open={addonPriceModalVisible}
        onCancel={() => setAddonPriceModalVisible(false)}
        onOk={() => addonPriceForm.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={480}
      >
        <Form form={addonPriceForm} layout="vertical" onFinish={handleUpdateAddonPrice}>
          <Form.Item
            name="agreement_price"
            label={labels.formAddonAgreementPrice}
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: '100%' }} precision={2} size="large" prefix="RM" min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
