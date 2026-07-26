import React, { useEffect, useState } from 'react';
import {
  App, Card, Table, DatePicker, Select, Tag, Typography, Space, Button,
  Badge, Modal, Form, InputNumber, Input, Row, Col, Popconfirm, Divider,
  Spin, Empty, Tooltip
} from 'antd';
import {
  ReloadOutlined, EditOutlined, DeleteOutlined, HistoryOutlined,
  UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

// NOTE: 定义餐次与套餐分类的对应关系，用于编辑订单时过滤可选套餐
const MEAL_SECTION_CATEGORIES: Record<string, string[]> = {
  '早餐': ['早餐'],
  'Breakfast': ['早餐'],
  '早班午餐': ['饭盒', '大型供餐'],
  'Day Shift Lunch': ['饭盒', '大型供餐'],
  '早班晚餐': ['饭盒', '大型供餐'],
  'Day Shift Dinner': ['饭盒', '大型供餐'],
  '客户/顾问加餐饭盒': ['饭盒', '大型供餐'],
  'Visitor Bento': ['饭盒', '大型供餐'],
  '夜班餐食 10pm Buffet': ['Buffet'],
  'Night Shift 10pm Buffet': ['Buffet'],
  '夜班餐食 3am 宵夜': ['宵夜'],
  'Night Shift 3am Supper': ['宵夜'],
};


/** 订单操作记录 Modal（参照截图设计：深色顶栏 + 时间线 + diff 变更视图） */
const OrderAuditDrawer: React.FC<{
  orderId: number | null;
  orderLabel: string;
  open: boolean;
  onClose: () => void;
  isEn: boolean;
}> = ({ orderId, orderLabel, open, onClose, isEn }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    axiosInstance
      .get(`/admin/orders/${orderId}/audit-logs`)
      .then((res) => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  /**
   * 解析 extra_data JSON 中的 changes 数组
   */
  const parseChanges = (extraDataStr: string | null): Array<{ field: string; old: string; new: string }> => {
    if (!extraDataStr) return [];
    try {
      const data = JSON.parse(extraDataStr);
      return Array.isArray(data.changes) ? data.changes : [];
    } catch {
      return [];
    }
  };

  /**
   * 操作类型 → 操作标题
   */
  const getActionTitle = (actionType: string): string => {
    const map: Record<string, { zh: string; en: string }> = {
      ORDER_CREATE: { zh: '创建新订单', en: 'Order Created' },
      ORDER_UPDATE: { zh: '修改订单内容', en: 'Order Updated' },
      ORDER_DELETE: { zh: '删除订单', en: 'Order Deleted' },
      ORDER_STATUS_CHANGE: { zh: '修改订单状态', en: 'Status Changed' },
    };
    return isEn ? (map[actionType]?.en ?? actionType) : (map[actionType]?.zh ?? actionType);
  };

  /**
   * 角色 → 角色 badge（与截图 ADMIN / CUSTOMER 样式一致）
   */
  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'superadmin' || role === 'staff';
    return (
      <span style={{
        background: isAdmin ? '#dcfce7' : '#dbeafe',
        color: isAdmin ? '#166534' : '#1e40af',
        border: `1px solid ${isAdmin ? '#bbf7d0' : '#bfdbfe'}`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 800,
        padding: '1px 8px',
        letterSpacing: '0.6px',
        textTransform: 'uppercase' as const,
      }}>
        {isAdmin ? 'ADMIN' : 'CUSTOMER'}
      </span>
    );
  };

  /**
   * 格式化时间戳为截图风格: "19 Jul 2026, 13:58:39"
   */
  const formatTimestamp = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.toTimeString().slice(0, 8)}`;
    } catch {
      return dateStr ?? '';
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button
            onClick={onClose}
            style={{
              background: '#1a1f3a', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0 32px', height: 38, fontWeight: 700, fontSize: 14,
            }}
          >
            {isEn ? 'Close' : '关闭'}
          </Button>
        </div>
      }
      closeIcon={
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1,
        }}>
          ×
        </div>
      }
      width={680}
      style={{ top: 30 }}
      styles={{
        header: {
          background: '#1a1f3a',
          borderRadius: '12px 12px 0 0',
          padding: '20px 24px 18px',
        },
        body: {
          background: '#ffffff',
          padding: '24px 28px',
          maxHeight: '62vh',
          overflowY: 'auto',
        },
        content: {
          borderRadius: 12,
          overflow: 'hidden',
          padding: 0,
        },
        footer: {
          background: '#fff',
          borderTop: '1px solid #f1f5f9',
          padding: '12px 24px',
          borderRadius: '0 0 12px 12px',
        },
      }}
      title={
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(96,165,250,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, color: '#93c5fd',
            }}>
              <HistoryOutlined />
            </div>
            <span style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '0.3px' }}>
              {isEn ? 'Operation History' : '操作历史'}
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 7, paddingLeft: 46 }}>
            {isEn ? 'Order No.: ' : '订单编号：'}{orderLabel}
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <Spin size="large" />
        </div>
      ) : logs.length === 0 ? (
        <Empty
          description={isEn ? 'No operation records found' : '暂无操作记录'}
          style={{ marginTop: 40, marginBottom: 20 }}
        />
      ) : (
        <div>
          {logs.map((log, index) => {
            const changes = parseChanges(log.extra_data);
            const actionTitle = getActionTitle(log.action_type);
            // NOTE: 根据操作类型决定时间线圆点颜色
            const dotColor = log.action_type === 'ORDER_CREATE'
              ? '#3b82f6'
              : log.action_type === 'ORDER_DELETE'
              ? '#ef4444'
              : log.action_type === 'ORDER_STATUS_CHANGE'
              ? '#f59e0b'
              : '#8b5cf6';

            return (
              <div key={log.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                {/* 左侧时间线：彩色实心圆点 + 竖线 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0, paddingTop: 4 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: dotColor,
                    boxShadow: `0 0 0 3px ${dotColor}22`,
                    flexShrink: 0,
                  }} />
                  {index < logs.length - 1 && (
                    <div style={{ width: 1.5, flex: 1, background: '#e2e8f0', margin: '6px 0', minHeight: 32 }} />
                  )}
                </div>

                {/* 右侧内容区：无卡片，直接裸露 */}
                <div style={{
                  flex: 1,
                  paddingBottom: index < logs.length - 1 ? 24 : 8,
                }}>
                  {/* 操作标题 + 时间戳 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', lineHeight: 1.3 }}>
                      {actionTitle}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2px', flexShrink: 0, marginLeft: 12, paddingTop: 1 }}>
                      {formatTimestamp(log.created_at)}
                    </span>
                  </div>

                  {/* 操作人 + 角色 badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: changes.length > 0 ? 10 : 0 }}>
                    <UserOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                    <span style={{
                      fontSize: 12, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>
                      {log.operator_name}
                    </span>
                    {getRoleBadge(log.operator_role)}
                  </div>

                  {/* 变更字段列表：旧值（红删除线）→ 新值（绿） */}
                  {changes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {changes.map((change: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#94a3b8' }}>{change.field}:</span>
                          <span style={{ color: '#f87171', textDecoration: 'line-through' }}>
                            {String(change.old ?? '')}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>→</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>
                            {String(change.new ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};


export const DailyOrderStatus: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Orders Status' : '订单状态',
    loadFailed: isEn ? 'Failed to fetch orders' : '获取订单失败',
    statusUpdated: isEn ? 'Order status updated successfully' : '订单状态已更新',
    statusUpdateFailed: isEn ? 'Failed to update order status' : '修改状态失败',
    deleteSuccess: isEn ? 'Order deleted successfully' : '订单已成功删除',
    deleteFailed: isEn ? 'Failed to delete order' : '删除订单失败',
    saveSuccess: isEn ? 'Order updated successfully!' : '后台已成功修改该订单数据！',
    saveFailed: isEn ? 'Failed to save order updates' : '保存订单修改失败',
    colOrderId: isEn ? 'Order ID' : '编号',
    colDeliveryDate: isEn ? 'Delivery Date' : '日期',
    colCustomer: isEn ? 'Customer Client' : '客户',
    colSite: isEn ? 'Delivery Site' : '送餐',
    colDetails: isEn ? 'Meal & Package Details' : '套餐明细',
    portions: isEn ? 'portions' : '份',
    colTotalPortions: isEn ? 'Total Portions' : '配餐份数',
    colTotalPrice: isEn ? 'Amount (RM)' : '金额 (RM)',
    colStatus: isEn ? 'Current Status' : '状态',
    colAction: isEn ? 'Admin Management' : '数据管理',
    btnEdit: isEn ? 'Edit' : '编辑',
    btnDelete: isEn ? 'Delete' : '删除',
    btnHistory: isEn ? 'History' : '操作记录',
    confirmDeleteTitle: isEn ? 'Confirm Delete' : '删除订单确认',
    confirmDeleteDesc: isEn ? 'Are you sure you want to delete this order?' : '确定要彻底删除该笔订单吗？',
    filterAll: isEn ? 'All Statuses' : '全状态',
    statusSubmitted: isEn ? 'Submitted' : '已提交',
    statusDelivered: isEn ? 'Delivered' : '已送达',
    statusBilled: isEn ? 'Billed' : '已核账',
    statusPaid: isEn ? 'Paid' : '已付款',
    statusCancelled: isEn ? 'Cancelled' : '取消',
    modalEditTitle: isEn ? 'Edit Order Details' : '编辑订单',
    formDeliverySite: isEn ? 'Delivery Site / Factory' : '选择送货地址/分点',
    btnSave: isEn ? 'Save Changes' : '保存修改',
    btnCancel: isEn ? 'Cancel' : '取消',
    colModalMeal: isEn ? 'Shift' : '餐次',
    colModalPkg: isEn ? 'Package Name' : '套餐名称',
    colModalQty: isEn ? 'Order Quantity' : '预订份数',
    colModalRemark: isEn ? 'Detail Remark' : '明细备注',
    btnRefresh: isEn ? 'Refresh' : '刷新数据',
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 编辑订单 Modal 状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editSiteId, setEditSiteId] = useState<number | null>(null);
  const [editDetails, setEditDetails] = useState<any[]>([]);

  const [customerSites, setCustomerSites] = useState<any[]>([]);
  const [customerPackages, setCustomerPackages] = useState<any[]>([]);

  // NOTE: 操作记录抽屉状态
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditTargetOrderId, setAuditTargetOrderId] = useState<number | null>(null);
  const [auditTargetLabel, setAuditTargetLabel] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/admin/all-orders?start_date=${dateRange[0].format('YYYY-MM-DD')}&end_date=${dateRange[1].format('YYYY-MM-DD')}`;
      const res = await axiosInstance.get(url);
      setOrders(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dateRange]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await axiosInstance.put(`/admin/orders/${orderId}/status?status=${newStatus}`);
      message.success(labels.statusUpdated);
      fetchOrders();
    } catch (err) {
      message.error(labels.statusUpdateFailed);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    try {
      await axiosInstance.delete(`/admin/orders/${orderId}`);
      message.success(labels.deleteSuccess);
      fetchOrders();
    } catch (err) {
      message.error(labels.deleteFailed);
    }
  };

  const handleOpenEditModal = async (orderRecord: any) => {
    setEditingOrder(orderRecord);
    setEditSiteId(orderRecord.site_id);
    setEditDetails(orderRecord.details.map((d: any) => ({ ...d })));

    try {
      const resCusts = await axiosInstance.get('/admin/customers');
      const cur = resCusts.data.find((c: any) => c.id === orderRecord.customer_id);
      if (cur && cur.sites) {
        setCustomerSites(cur.sites);
      }

      const resPkgs = await axiosInstance.get(`/admin/customers/${orderRecord.customer_id}/packages`);
      setCustomerPackages(resPkgs.data);
    } catch (err) {
      console.error(err);
    }

    setEditModalVisible(true);
  };

  /** 打开操作记录抽屉 */
  const handleOpenAuditDrawer = (record: any) => {
    setAuditTargetOrderId(record.id);
    setAuditTargetLabel(`${record.company_name} | ${record.delivery_date}`);
    setAuditDrawerOpen(true);
  };

  const handleDetailQtyChange = (idx: number, newQty: number) => {
    const updated = [...editDetails];
    updated[idx].quantity = newQty;
    setEditDetails(updated);
  };

  const handleDetailRemarkChange = (idx: number, newRmk: string) => {
    const updated = [...editDetails];
    updated[idx].remark = newRmk;
    setEditDetails(updated);
  };

  const handleSaveOrderEdit = async () => {
    if (!editingOrder || !editSiteId) return;

    try {
      await axiosInstance.put(`/admin/orders/${editingOrder.id}`, {
        site_id: editSiteId,
        delivery_date: editingOrder.delivery_date,
        items: editDetails.map((d: any) => ({
          meal_section_id: d.meal_section_id,
          customer_package_id: d.customer_package_id,
          quantity: d.quantity,
          remark: d.remark || ""
        }))
      });
      message.success(labels.saveSuccess);
      setEditModalVisible(false);
      fetchOrders();
    } catch (err) {
      message.error(labels.saveFailed);
    }
  };

  const translateMealSection = (name: string) => {
    if (!isEn) return name;
    const map: Record<string, string> = {
      '早餐': 'Breakfast',
      '早班午餐': 'Day Shift Lunch',
      '早班晚餐': 'Day Shift Dinner',
      '客户/顾问加餐饭盒': 'Visitor Bento',
      '夜班餐食 10pm Buffet': 'Night Shift 10pm Buffet',
      '夜班餐食 3am 宵夜': 'Night Shift 3am Supper',
      '上午餐': 'Morning Meal',
      '午餐': 'Lunch',
      '晚餐': 'Dinner'
    };
    return map[name] || name;
  };

  const translatePackageTemplateName = (name: string) => {
    if (!isEn) return name;
    if (name.includes('饭盒') && name.includes('2菜1肉')) return 'Bento Box (2 Veg 1 Meat 1 Fruit)';
    if (name.includes('日式饭盒')) return 'Japanese Bento Box';
    if (name.includes('Buffet 自助餐')) return 'Buffet Meal';
    return name;
  };

  const filteredOrders = orders.filter((o) => statusFilter === 'all' || o.status === statusFilter);

  const columns = [
    { title: labels.colOrderId, dataIndex: 'id', key: 'id', width: 90, render: (val: number) => <Text type="secondary">#{val}</Text> },
    { title: labels.colDeliveryDate, dataIndex: 'delivery_date', key: 'delivery_date', width: 120, render: (text: string) => <Text strong>{text}</Text> },
    { title: labels.colCustomer, dataIndex: 'company_name', key: 'company_name', width: 160, render: (text: string) => <Text strong style={{ color: '#0f172a' }}>{text}</Text> },
    { title: labels.colSite, dataIndex: 'site_name', key: 'site_name', width: 150, render: (text: string) => <Tag color="geekblue">{text}</Tag> },
    {
      title: labels.colDetails,
      dataIndex: 'details',
      key: 'details',
      // NOTE: render 第一参数是 dataIndex 对应的字段值（details 数组）
      render: (details: any[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(details || []).map((d: any, idx: number) => (
            <div key={idx} style={{ fontSize: 13 }}>
              <Text strong>{translateMealSection(d.meal_section)}: </Text>
              <Text>{translatePackageTemplateName(d.package_name)}</Text>
              <Tag color="green" style={{ marginLeft: 6 }}>{d.quantity} {labels.portions}</Tag>
              {d.unit_price > 0 && (
                <Tag color="gold" style={{ fontSize: 11, marginLeft: 2 }}>
                  {d.quantity} × RM{d.unit_price.toFixed(2)} = RM{d.subtotal ? d.subtotal.toFixed(2) : (d.quantity * d.unit_price).toFixed(2)}
                </Tag>
              )}
              {d.remark && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>({d.remark})</Text>}
            </div>
          ))}
        </div>
      )
    },
    { title: labels.colTotalPortions, dataIndex: 'total_portions', key: 'total_portions', width: 110, render: (val: number) => <Badge count={`${val} ${labels.portions}`} overflowCount={999} style={{ backgroundColor: '#dc2626' }} /> },
    { title: labels.colTotalPrice, dataIndex: 'total_price', key: 'total_price', width: 130, render: (val: number) => <Text strong style={{ color: '#dc2626' }}>RM {val.toFixed(2)}</Text> },
    {
      title: labels.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 150,
      // NOTE: 加了 dataIndex='status'，render 第一参数为 status 值，第二参数为整行 record
      render: (_: string, record: any) => (
        <Select
          value={record.status}
          style={{ width: 130 }}
          onChange={(val) => handleStatusChange(record.id, val)}
        >
          <Option value="submitted"><Tag color="blue">{labels.statusSubmitted}</Tag></Option>
          <Option value="delivered"><Tag color="green">{labels.statusDelivered}</Tag></Option>
          <Option value="billed"><Tag color="purple">{labels.statusBilled}</Tag></Option>
          <Option value="paid"><Tag color="gold">{labels.statusPaid}</Tag></Option>
          <Option value="cancelled"><Tag color="red">{labels.statusCancelled}</Tag></Option>
        </Select>
      )
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 200,
      // NOTE: 无 dataIndex 时，render 第一参数为 undefined，第二参数为整行 record
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenEditModal(record)}>
            {labels.btnEdit}
          </Button>

          {/* NOTE: 操作记录按钮 — 点击弹出该订单的完整操作历史抽屉 */}
          <Tooltip title={labels.btnHistory}>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleOpenAuditDrawer(record)}
              style={{
                borderColor: '#2563eb',
                color: '#2563eb',
              }}
            >
              {labels.btnHistory}
            </Button>
          </Tooltip>

          <Popconfirm
            title={labels.confirmDeleteTitle}
            description={labels.confirmDeleteDesc}
            onConfirm={() => handleDeleteOrder(record.id)}
            okText={labels.btnDelete}
            cancelText={labels.btnCancel}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {labels.btnDelete}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Title level={4} style={{ margin: 0 }}>📋 {labels.title}</Title>
            <Space style={{ flexWrap: 'wrap' }}>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
                allowClear={false}
              />
              <Select value={statusFilter} onChange={(val) => setStatusFilter(val)} style={{ width: 140 }}>
                <Option value="all">{labels.filterAll}</Option>
                <Option value="submitted">{labels.statusSubmitted}</Option>
                <Option value="delivered">{labels.statusDelivered}</Option>
                <Option value="billed">{labels.statusBilled}</Option>
                <Option value="paid">{labels.statusPaid}</Option>
                <Option value="cancelled">{labels.statusCancelled}</Option>
              </Select>
              <Button type="primary" icon={<ReloadOutlined />} onClick={fetchOrders}>{labels.btnRefresh}</Button>
            </Space>
          </div>
        }
      >
        <Table columns={columns} dataSource={filteredOrders} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />

        {/* 编辑订单 Modal */}
        <Modal
          title={labels.modalEditTitle}
          open={editModalVisible}
          onCancel={() => setEditModalVisible(false)}
          onOk={handleSaveOrderEdit}
          okText={labels.btnSave}
          cancelText={labels.btnCancel}
          width={720}
        >
          {editingOrder && (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Text strong>{labels.colCustomer}: </Text>
                  <Text>{editingOrder.company_name}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>{labels.colDeliveryDate}: </Text>
                  <Text>{editingOrder.delivery_date}</Text>
                </Col>
              </Row>

              <Form.Item label={labels.formDeliverySite} required>
                <Select value={editSiteId} onChange={(val) => setEditSiteId(val)} style={{ width: '100%' }}>
                  {customerSites.map((s: any) => (
                    <Option key={s.id} value={s.id}>{s.site_name}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider />

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>{labels.colModalMeal}</th>
                    <th>{labels.colModalPkg}</th>
                    <th style={{ width: 120 }}>{labels.colModalQty}</th>
                    <th>{labels.colModalRemark}</th>
                  </tr>
                </thead>
                <tbody>
                  {editDetails.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 0' }}>
                        <Text strong>{translateMealSection(item.meal_section)}</Text>
                      </td>
                      <td>
                        <Select
                          value={item.customer_package_id}
                          onChange={(val) => {
                            const updated = [...editDetails];
                            updated[idx].customer_package_id = val;
                            const pkg = customerPackages.find(p => p.id === val);
                            if (pkg) {
                              updated[idx].package_name = pkg.template_name;
                            }
                            setEditDetails(updated);
                          }}
                          style={{ width: '90%' }}
                        >
                          {customerPackages
                            .filter(p => MEAL_SECTION_CATEGORIES[item.meal_section]?.includes(p.category))
                            .map(p => (
                              <Option key={p.id} value={p.id}>{translatePackageTemplateName(p.template_name)}</Option>
                            ))}
                        </Select>
                      </td>
                      <td>
                        <InputNumber
                          min={0}
                          value={item.quantity}
                          onChange={(val) => handleDetailQtyChange(idx, val || 0)}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <Input
                          value={item.remark}
                          onChange={(e) => handleDetailRemarkChange(idx, e.target.value)}
                          placeholder="Remarks"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      </Card>

      {/* NOTE: 操作记录抽屉 — 独立于 Card 外部，避免层级问题 */}
      <OrderAuditDrawer
        orderId={auditTargetOrderId}
        orderLabel={auditTargetLabel}
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        isEn={isEn}
      />
    </>
  );
};
