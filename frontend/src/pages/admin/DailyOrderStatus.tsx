import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Card, Table, DatePicker, Select, Tag, Typography, Space, Button,
  Badge, Modal, Form, InputNumber, Input, Row, Col, Divider,
  Spin, Empty, Tooltip, Alert
} from 'antd';
import {
  ReloadOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, PlusOutlined,
  MinusOutlined, UserOutlined, WhatsAppOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';
import { getEffectiveMealSectionCategories } from '../../utils/mealSectionRules';
import { OrderBillModal } from '../../components/OrderBillModal';

const { Title, Text } = Typography;
const { Option } = Select;

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
  const parseExtraData = (extraDataStr: string | null): Record<string, any> => {
    if (!extraDataStr) return {};
    try {
      return JSON.parse(extraDataStr) || {};
    } catch {
      return {};
    }
  };

  const formatChangeValue = (field: string, value: unknown): string => {
    const text = String(value ?? '');
    if (!field.includes('状态') && !field.toLowerCase().includes('status')) return text;
    const statusLabels: Record<string, { zh: string; en: string }> = {
      submitted: { zh: '已提交', en: 'Submitted' },
      confirmed: { zh: '已确认', en: 'Confirmed' },
      in_production: { zh: '生产中', en: 'In Production' },
      delivered: { zh: '已送达', en: 'Delivered' },
      billed: { zh: '已核账', en: 'Billed' },
      paid: { zh: '已付款', en: 'Paid' },
      cancelled: { zh: '已取消', en: 'Cancelled' },
    };
    return isEn ? (statusLabels[text]?.en || text) : (statusLabels[text]?.zh || text);
  };

  /**
   * 操作类型 → 操作标题
   */
  const getActionTitle = (actionType: string): string => {
    const map: Record<string, { zh: string; en: string }> = {
      ORDER_CREATE: { zh: '创建新订单', en: 'Order Created' },
      ORDER_UPDATE: { zh: '修改订单内容', en: 'Order Updated' },
      ORDER_DELETE: { zh: '删除订单', en: 'Order Deleted' },
      ORDER_CANCEL: { zh: '取消订单', en: 'Order Cancelled' },
      ORDER_STATUS_CHANGE: { zh: '修改订单状态', en: 'Status Changed' },
      WHATSAPP_SEND: { zh: 'WhatsApp 发送任务', en: 'WhatsApp Delivery' },
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
        root: {
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
            {isEn ? 'DO No.: ' : 'DO编号：'}{orderLabel}
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
            const extraData = parseExtraData(log.extra_data);
            const changes = Array.isArray(extraData.changes) ? extraData.changes : [];
            const actionTitle = getActionTitle(log.action_type);
            // NOTE: 根据操作类型决定时间线圆点颜色
            const dotColor = log.action_type === 'ORDER_CREATE'
              ? '#3b82f6'
              : ['ORDER_DELETE', 'ORDER_CANCEL'].includes(log.action_type)
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
                            {formatChangeValue(change.field, change.old)}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>→</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>
                            {formatChangeValue(change.field, change.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {extraData.reason && (
                    <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 6, background: '#f8fafc', color: '#64748b', fontSize: 12 }}>
                      <Text type="secondary">{isEn ? 'Reason: ' : '操作原因：'}</Text>
                      <Text>{extraData.reason}</Text>
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
    deleteSuccess: isEn ? 'Order cancelled successfully' : 'DO 已成功取消',
    deleteFailed: isEn ? 'Failed to cancel order' : '取消 DO 失败',
    saveSuccess: isEn ? 'Order updated successfully!' : '后台已成功修改该订单数据！',
    saveFailed: isEn ? 'Failed to save order updates' : '保存订单修改失败',
    colOrderId: isEn ? 'DO Number' : 'DO编号',
    colDeliveryDate: isEn ? 'Delivery Date' : '日期',
    colCustomer: isEn ? 'Customer Client' : '客户',
    colSite: isEn ? 'Delivery Site' : '送餐',
    colDetails: isEn ? 'Meal & Package Details' : '套餐明细',
    portions: isEn ? 'portions' : '份',
    colTotalPortions: isEn ? 'Total Portions' : '配餐份数',
    colTotalPrice: isEn ? 'Amount (RM)' : '金额 (RM)',
    colStatus: isEn ? 'Current Status' : '状态',
    colAction: isEn ? 'Admin Management' : '数据管理',
    colWhatsApp: isEn ? 'WhatsApp' : 'WhatsApp发送',
    btnWhatsAppResend: isEn ? 'Send DO to WhatsApp' : 'WhatsApp 发送 DO',
    whatsappReason: isEn ? 'WhatsApp send reason' : 'WhatsApp 发送原因',
    whatsappSent: isEn ? 'WhatsApp Gateway accepted the message' : 'WhatsApp Gateway 已接受发送',
    whatsappResendProcessed: isEn ? 'WhatsApp send processed' : 'WhatsApp 发送已处理',
    whatsappFailed: isEn ? 'WhatsApp delivery failed; use the WhatsApp button to send manually' : 'WhatsApp 发送失败；请按 WhatsApp 按键手动发送',
    btnEdit: isEn ? 'Edit' : '编辑',
    btnDelete: isEn ? 'Cancel DO' : '取消 DO',
    btnHistory: isEn ? 'History' : '操作记录',
    btnViewBill: isEn ? 'View Bill' : '查看账单',
    confirmDeleteTitle: isEn ? 'Confirm DO Cancellation' : '确认取消 DO',
    confirmDeleteDesc: isEn ? 'Cancel this DO? The record and details will be retained in the audit history.' : '确定取消这张 DO 吗？系统会保留 DO、明细及审计记录。',
    btnPermanentDelete: isEn ? 'Delete cancelled DO' : '删除已取消 DO',
    confirmPermanentDeleteTitle: isEn ? 'Permanently delete cancelled DO?' : '确认永久删除已取消 DO？',
    confirmPermanentDeleteDesc: isEn ? 'The order row will be removed so a new same-day order can be placed. A complete snapshot remains in the Audit Log.' : '删除后可重新建立同客户、同地点、同日期订单；原 DO、餐品、金额及发送记录的完整快照会保留在 Audit Log。',
    permanentDeleteSuccess: isEn ? 'Cancelled DO deleted; audit snapshot retained' : '已删除取消 DO，并保留完整审计快照',
    permanentDeleteFailed: isEn ? 'Failed to delete cancelled DO' : '删除已取消 DO 失败',
    filterAll: isEn ? 'All Statuses' : '全状态',
    statusSubmitted: isEn ? 'Submitted' : '已提交',
    statusConfirmed: isEn ? 'Confirmed' : '已确认',
    statusInProduction: isEn ? 'In Production' : '生产中',
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
    reason: isEn ? 'Operation Reason' : '操作原因',
    reasonPlaceholder: isEn ? 'Required. This will be stored in the audit log.' : '必填，内容将写入 Audit Log',
    reasonRequired: isEn ? 'Please enter at least 3 characters.' : '请输入至少 3 个字的操作原因',
    btnCreate: isEn ? 'Create Order for Customer' : '代顾客下单',
    lateOverride: isEn ? 'Late Admin Override' : '后台逾期处理',
    createHint: isEn ? 'The available shifts and packages are identical to the customer ordering page.' : '餐次与套餐与顾客下单页面一致，仅显示已为该顾客开通的选项。',
    emptyPackages: isEn ? 'No ordering packages are available for this customer.' : '该顾客暂无可下单的餐次或套餐。',
    orderRemark: isEn ? 'Order Remark' : '订单备注',
    orderRemarkPlaceholder: isEn ? 'Optional note applied to the selected meal items' : '选填，将写入已选餐品明细',
    orderSummary: isEn ? 'Order Summary' : '订单摘要',
    noItems: isEn ? 'No meal items selected' : '尚未选择餐品',
    totalPortions: isEn ? 'Total Portions' : '总份数',
    selected: isEn ? 'Selected' : '已选',
    extraRice: isEn ? 'Extra Rice' : '加白饭',
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billOrderId, setBillOrderId] = useState<number | null>(null);
  const tablePanRef = useRef<HTMLDivElement>(null);
  const tablePanStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    scroller: HTMLDivElement;
  } | null>(null);

  const stopTablePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tablePanStateRef.current || tablePanStateRef.current.pointerId !== event.pointerId) return;
    tablePanStateRef.current = null;
    event.currentTarget.classList.remove('is-panning');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTablePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"], [role="combobox"], .ant-select, .ant-picker, .ant-pagination')) return;
    const scroller = tablePanRef.current?.querySelector<HTMLDivElement>('.ant-table-content');
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    tablePanStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
      scroller,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-panning');
  };

  const handleTablePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panState = tablePanStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    const distance = event.clientX - panState.startX;
    if (Math.abs(distance) > 2) event.preventDefault();
    panState.scroller.scrollLeft = panState.startScrollLeft - distance;
  };

  // 编辑订单 Modal 状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editSiteId, setEditSiteId] = useState<number | null>(null);
  const [editDetails, setEditDetails] = useState<any[]>([]);
  const [editReason, setEditReason] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createCustomers, setCreateCustomers] = useState<any[]>([]);
  const [createCustomerId, setCreateCustomerId] = useState<number | null>(null);
  const [createSites, setCreateSites] = useState<any[]>([]);
  const [createSiteId, setCreateSiteId] = useState<number | null>(null);
  const [createDate, setCreateDate] = useState<dayjs.Dayjs>(dayjs().add(1, 'day'));
  const [createPackages, setCreatePackages] = useState<any[]>([]);
  const [createCustomerAddons, setCreateCustomerAddons] = useState<any[]>([]);
  const [allCreateSections, setAllCreateSections] = useState<any[]>([]);
  const [createSections, setCreateSections] = useState<any[]>([]);
  const [createItems, setCreateItems] = useState<any[]>([]);
  const [createAddons, setCreateAddons] = useState<Record<string, number>>({});
  const [createAdminAddonSections, setCreateAdminAddonSections] = useState<Record<number, number>>({});
  const [createRemark, setCreateRemark] = useState('');
  const [createReason, setCreateReason] = useState('');

  const [customerSites, setCustomerSites] = useState<any[]>([]);
  const [customerPackages, setCustomerPackages] = useState<any[]>([]);
  const [editMealSections, setEditMealSections] = useState<any[]>([]);
  const editMealSectionsById = useMemo(
    () => new Map(editMealSections.map(section => [section.id, section])),
    [editMealSections],
  );

  // NOTE: 操作记录抽屉状态
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditTargetOrderId, setAuditTargetOrderId] = useState<number | null>(null);
  const [auditTargetLabel, setAuditTargetLabel] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/all-orders', {
        params: dateRange
          ? {
              start_date: dateRange[0].format('YYYY-MM-DD'),
              end_date: dateRange[1].format('YYYY-MM-DD'),
            }
          : undefined,
      });
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
    const record = orders.find(order => order.id === orderId);
    let reason = '';
    Modal.confirm({
      title: labels.reason,
      content: <Input.TextArea rows={3} placeholder={labels.reasonPlaceholder} onChange={(event) => { reason = event.target.value; }} />,
      okText: labels.btnSave,
      cancelText: labels.btnCancel,
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(labels.reasonRequired);
          throw new Error('reason_required');
        }
        try {
          const response = await axiosInstance.put(`/admin/orders/${orderId}/status`, {
            status: newStatus,
            reason: reason.trim(),
            expected_order_version: record?.version,
          });
          notifyOperationResult(labels.statusUpdated, response.data?.whatsapp_delivery);
          await fetchOrders();
        } catch (err: any) {
          message.error(err.response?.data?.detail || labels.statusUpdateFailed);
          throw err;
        }
      },
    });
  };

  const handleDeleteOrder = (record: any) => {
    if (record.status === 'cancelled') {
      let reason = '';
      Modal.confirm({
        title: labels.confirmPermanentDeleteTitle,
        content: (
          <div>
            <Alert
              type="warning"
              showIcon
              title={record.do_number || `#${record.id}`}
              description={labels.confirmPermanentDeleteDesc}
            />
            <Input.TextArea
              rows={3}
              placeholder={labels.reasonPlaceholder}
              onChange={(event) => { reason = event.target.value; }}
              style={{ marginTop: 12 }}
            />
          </div>
        ),
        okText: labels.btnPermanentDelete,
        okType: 'danger',
        cancelText: labels.btnCancel,
        onOk: async () => {
          if (reason.trim().length < 3) {
            message.error(labels.reasonRequired);
            throw new Error('reason_required');
          }
          try {
            await axiosInstance.post(`/admin/orders/${record.id}/delete`, {
              reason: reason.trim(),
              expected_order_version: record.version,
            });
            message.success(labels.permanentDeleteSuccess);
            await fetchOrders();
          } catch (err: any) {
            message.error(err.response?.data?.detail || labels.permanentDeleteFailed);
            throw err;
          }
        },
      });
      return;
    }

    let reason = '';
    Modal.confirm({
      title: labels.confirmDeleteTitle,
      content: (
        <div>
          <Text type="secondary">{labels.confirmDeleteDesc}</Text>
          <Input.TextArea
            rows={3}
            placeholder={labels.reasonPlaceholder}
            onChange={(event) => { reason = event.target.value; }}
            style={{ marginTop: 12 }}
          />
        </div>
      ),
      okText: labels.btnDelete,
      okType: 'danger',
      cancelText: labels.btnCancel,
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(labels.reasonRequired);
          throw new Error('reason_required');
        }
        try {
          const response = await axiosInstance.post(`/admin/orders/${record.id}/cancel`, {
            reason: reason.trim(),
            expected_order_version: record.version,
          });
          notifyOperationResult(labels.deleteSuccess, response.data?.whatsapp_delivery);
          await fetchOrders();
        } catch (err: any) {
          message.error(err.response?.data?.detail || labels.deleteFailed);
          throw err;
        }
      },
    });
  };

  const handleOpenEditModal = async (orderRecord: any) => {
    setEditingOrder(orderRecord);
    setEditSiteId(orderRecord.site_id);
    setEditDetails(orderRecord.details.map((d: any) => ({ ...d })));
    setEditReason('');

    try {
      const [resCusts, resPkgs, resSections] = await Promise.all([
        axiosInstance.get('/admin/customers'),
        axiosInstance.get(`/admin/customers/${orderRecord.customer_id}/packages`),
        axiosInstance.get('/admin/meal-sections'),
      ]);
      const cur = resCusts.data.find((c: any) => c.id === orderRecord.customer_id);
      if (cur && cur.sites) {
        setCustomerSites(cur.sites);
      }

      setCustomerPackages(resPkgs.data);
      setEditMealSections(resSections.data || []);
    } catch (err) {
      console.error(err);
    }

    setEditModalVisible(true);
  };

  /** 打开操作记录抽屉 */
  const handleOpenAuditDrawer = (record: any) => {
    setAuditTargetOrderId(record.id);
    setAuditTargetLabel(record.do_number || `${record.company_name} | ${record.delivery_date}`);
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
    if (editReason.trim().length < 3) {
      message.error(labels.reasonRequired);
      return;
    }

    try {
      const response = await axiosInstance.put(`/admin/orders/${editingOrder.id}`, {
        site_id: editSiteId,
        delivery_date: editingOrder.delivery_date,
        reason: editReason.trim(),
        expected_order_version: editingOrder.version,
        items: editDetails.map((d: any) => ({
          meal_section_id: d.meal_section_id,
          customer_package_id: d.customer_package_id,
          customer_addon_id: d.customer_addon_id,
          parent_package_id: d.parent_package_id || Number((d.remark || '').match(/\[addon_for_customer_package:(\d+)\]/)?.[1]) || undefined,
          quantity: d.quantity,
          remark: d.remark || ""
        }))
      });
      notifyOperationResult(labels.saveSuccess, response.data?.whatsapp_delivery);
      setEditModalVisible(false);
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.saveFailed);
    }
  };

  const handleOpenCreateModal = async () => {
    try {
      const [customersRes, sectionsRes] = await Promise.all([
        axiosInstance.get('/admin/customers'),
        axiosInstance.get('/admin/meal-sections'),
      ]);
      setCreateCustomers(customersRes.data || []);
      setAllCreateSections(sectionsRes.data || []);
      setCreateCustomerId(null);
      setCreateSites([]);
      setCreateSiteId(null);
      setCreatePackages([]);
      setCreateCustomerAddons([]);
      setCreateSections([]);
      setCreateItems([]);
      setCreateAddons({});
      setCreateAdminAddonSections({});
      setCreateRemark('');
      setCreateDate(dayjs().add(1, 'day'));
      setCreateReason('');
      setCreateModalVisible(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.loadFailed);
    }
  };

  const handleCreateCustomerChange = async (customerId: number) => {
    setCreateCustomerId(customerId);
    setCreateAddons({});
    const customer = createCustomers.find(item => item.id === customerId);
    const sites = customer?.sites || [];
    setCreateSites(sites);
    setCreateSiteId(sites[0]?.id || null);
    try {
      const [packagesRes, sectionIdsRes, addonsRes] = await Promise.all([
        axiosInstance.get(`/admin/customers/${customerId}/packages`),
        axiosInstance.get(`/admin/customers/${customerId}/meal-sections`),
        axiosInstance.get(`/admin/customers/${customerId}/addons`),
      ]);
      const packages = (packagesRes.data || []).filter((pkg: any) => pkg.is_shown_to_customer !== false);
      const allowedIds = new Set<number>(sectionIdsRes.data || []);
      const sections = allCreateSections.filter(section => allowedIds.has(section.id));
      setCreatePackages(packages);
      setCreateSections(sections);
      setCreateCustomerAddons(addonsRes.data || []);
      const defaultSectionId = sections[0]?.id;
      setCreateAdminAddonSections(Object.fromEntries(
        (addonsRes.data || [])
          .filter((addon: any) => addon.is_customer_visible === false && defaultSectionId)
          .map((addon: any) => [addon.id, defaultSectionId])
      ));
      setCreateItems([]);
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.loadFailed);
    }
  };

  const handleCreateOrder = async () => {
    if (!createCustomerId || !createSiteId || (createItems.length === 0 && !Object.values(createAddons).some(quantity => quantity > 0))) {
      message.error(isEn ? 'Select a customer, site and at least one meal item.' : '请选择顾客、送餐地点及至少一项餐品');
      return;
    }
    if (createReason.trim().length < 3) {
      message.error(labels.reasonRequired);
      return;
    }
    try {
      const addonItems: any[] = [];
      createSections.forEach(section => {
        getCreatePackagesForSection(section).forEach(pkg => {
          getCreateAddonsForPackage(pkg.id).forEach(addon => {
            const quantity = createAddons[`package:${section.id}:${pkg.id}:${addon.id}`] || 0;
            if (quantity > 0) {
              addonItems.push({ meal_section_id: section.id, customer_addon_id: addon.id, parent_package_id: pkg.id, quantity, remark: `[addon_for_customer_package:${pkg.id}] 附加于：${pkg.template_name}` });
            }
          });
        });
      });
      createCustomerAddons.filter(addon => addon.is_customer_visible === false).forEach(addon => {
        const quantity = createAddons[`admin:${addon.id}`] || 0;
        const mealSectionId = createAdminAddonSections[addon.id];
        if (quantity > 0 && mealSectionId) {
          addonItems.push({ meal_section_id: mealSectionId, customer_addon_id: addon.id, quantity, remark: '后台另外加单' });
        }
      });

      const res = await axiosInstance.post('/admin/orders', {
        customer_id: createCustomerId,
        site_id: createSiteId,
        delivery_date: createDate.format('YYYY-MM-DD'),
        items: [
          ...createItems.map(item => ({ ...item, remark: createRemark.trim() })),
          ...addonItems,
        ],
        reason: createReason.trim(),
      });
      message.success(res.data?.late_override ? `${labels.saveSuccess} (${labels.lateOverride})` : labels.saveSuccess);
      setCreateModalVisible(false);
      await fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.saveFailed);
    }
  };

  const getCreatePackagesForSection = (section: any) => {
    const allowedCategories = getEffectiveMealSectionCategories(section?.name, section?.allowed_categories);
    return createPackages.filter(pkg => allowedCategories.includes(pkg.category));
  };

  const getCreateAddonsForPackage = (customerPackageId: number) =>
    createCustomerAddons.filter(addon =>
      addon.is_customer_visible !== false
      && (addon.customer_package_ids || []).includes(customerPackageId)
    );

  const getCreatePackageAddonSelections = () => createSections.flatMap(section =>
    getCreatePackagesForSection(section).flatMap(pkg =>
      getCreateAddonsForPackage(pkg.id).flatMap(addon => {
        const quantity = createAddons[`package:${section.id}:${pkg.id}:${addon.id}`] || 0;
        return quantity > 0 ? [{ section, pkg, addon, quantity }] : [];
      })
    )
  );

  const getEditPackagesForSection = (item: any) => {
    const section = editMealSectionsById.get(item.meal_section_id);
    const allowedCategories = getEffectiveMealSectionCategories(
      section?.name || item.meal_section,
      section?.allowed_categories,
    );
    return customerPackages.filter(pkg => allowedCategories.includes(pkg.category));
  };

  const getCreateQuantity = (mealSectionId: number, customerPackageId: number) =>
    createItems.find(item => item.meal_section_id === mealSectionId && item.customer_package_id === customerPackageId)?.quantity || 0;

  const setCreateQuantity = (mealSectionId: number, customerPackageId: number, quantity: number) => {
    const safeQuantity = Math.max(0, quantity || 0);
    setCreateItems(current => {
      const remaining = current.filter(item => !(item.meal_section_id === mealSectionId && item.customer_package_id === customerPackageId));
      return safeQuantity > 0
        ? [...remaining, { meal_section_id: mealSectionId, customer_package_id: customerPackageId, quantity: safeQuantity, remark: '' }]
        : remaining;
    });
  };

  const setCreateAddonQuantity = (key: string, quantity: number) => {
    setCreateAddons(current => ({ ...current, [key]: Math.max(0, quantity || 0) }));
  };

  const createTotalPortions = createItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

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

  const getMealDisplayOrder = (name: string) => {
    const normalized = name.toLowerCase();
    if (name.includes('早餐') || normalized === 'breakfast') return { group: 0, item: 0 };
    if (name.includes('早班午餐') || normalized.includes('day shift lunch')) return { group: 1, item: 0 };
    if (name.includes('早班晚餐') || normalized.includes('day shift dinner')) return { group: 1, item: 1 };
    if (name.includes('客户') || name.includes('顾问') || normalized.includes('visitor')) return { group: 1, item: 2 };
    if (name.includes('10pm') || normalized.includes('10pm')) return { group: 2, item: 0 };
    if (name.includes('3am') || normalized.includes('3am')) return { group: 2, item: 1 };
    return { group: 3, item: 0 };
  };

  const getMealGroupLabel = (group: number) => {
    const labelsByGroup = isEn
      ? ['Breakfast', 'Day Shift Meals', 'Night Shift Meals', 'Other Meals']
      : ['早餐', '日班餐', '夜班餐', '其他餐次'];
    return labelsByGroup[group];
  };

  const filteredOrders = orders.filter((o) => statusFilter === 'all' || o.status === statusFilter);

  const notifyOperationResult = (successText: string, delivery: any) => {
    if (delivery?.status === 'failed') {
      message.warning(`${successText}；${labels.whatsappFailed}：${delivery.last_error || '-'}`);
      return;
    }
    if (delivery) {
      message.success(`${successText}；${labels.whatsappSent}`);
      return;
    }
    message.success(successText);
  };

  const renderWhatsAppStatus = (delivery: any) => {
    if (!delivery) return <Tag>{isEn ? 'Not sent' : '未发送'}</Tag>;
    const status = delivery.status;
    const config: Record<string, { color: string; zh: string; en: string }> = {
      pending: { color: 'warning', zh: '待手动处理', en: 'Manual action' },
      sending: { color: 'processing', zh: '发送中', en: 'Sending' },
      sent: { color: 'blue', zh: '已发送', en: 'Sent' },
      server: { color: 'cyan', zh: '服务器已收', en: 'Server' },
      device: { color: 'success', zh: '已送达', en: 'Delivered' },
      read: { color: 'success', zh: '已读', en: 'Read' },
      failed: { color: 'error', zh: '发送失败', en: 'Failed' },
      superseded: { color: 'default', zh: '旧版已取代', en: 'Superseded' },
    };
    const value = config[status] || { color: 'default', zh: status, en: status };
    return <Tooltip title={delivery.last_error || delivery.group_name || ''}><Tag color={value.color}>{isEn ? value.en : value.zh}</Tag></Tooltip>;
  };

  const handleWhatsAppResend = (record: any) => {
    let reason = '';
    Modal.confirm({
      title: `${labels.btnWhatsAppResend} — ${record.do_number}`,
      content: <Input.TextArea rows={3} placeholder={labels.whatsappReason} onChange={(event) => { reason = event.target.value; }} />,
      okText: labels.btnWhatsAppResend,
      cancelText: labels.btnCancel,
      onOk: async () => {
        if (reason.trim().length < 3) {
          message.error(labels.reasonRequired);
          throw new Error('reason_required');
        }
        try {
          const response = await axiosInstance.post(`/admin/orders/${record.id}/whatsapp-resend`, {
            reason: reason.trim(),
            expected_order_version: record.version,
          });
          notifyOperationResult(labels.whatsappResendProcessed, response.data?.delivery);
          await fetchOrders();
        } catch (error: any) {
          message.error(error.response?.data?.detail || labels.whatsappFailed);
          throw error;
        }
      },
    });
  };

  const statusOptions = [
    { value: 'submitted', label: labels.statusSubmitted, color: 'blue' },
    { value: 'confirmed', label: labels.statusConfirmed, color: 'orange' },
    { value: 'in_production', label: labels.statusInProduction, color: 'purple' },
    { value: 'delivered', label: labels.statusDelivered, color: 'green' },
    { value: 'billed', label: labels.statusBilled, color: 'purple' },
    { value: 'paid', label: labels.statusPaid, color: 'gold' },
    { value: 'cancelled', label: labels.statusCancelled, color: 'red' },
  ];
  const statusRank: Record<string, number> = {
    submitted: 0,
    confirmed: 1,
    in_production: 2,
    delivered: 3,
    billed: 4,
    paid: 5,
  };
  const availableStatusOptions = (currentStatus: string) => statusOptions.filter((option) => {
    if (option.value === currentStatus) return true;
    if (currentStatus === 'cancelled' || currentStatus === 'paid') return false;
    if (currentStatus === 'submitted') return ['confirmed', 'cancelled'].includes(option.value);
    if (option.value === 'submitted') return false;
    if (option.value === 'cancelled') return !['billed', 'paid'].includes(currentStatus);
    return (statusRank[option.value] ?? -1) > (statusRank[currentStatus] ?? -1);
  });

  const columns = [
    { title: labels.colOrderId, dataIndex: 'do_number', key: 'do_number', width: 175, render: (value: string) => <Text strong>{value || '-'}</Text> },
    { title: labels.colDeliveryDate, dataIndex: 'delivery_date', key: 'delivery_date', width: 145, render: (text: string, record: any) => <div><Text strong>{text}</Text>{record.is_late_override && <div><Tag color="warning">{labels.lateOverride}</Tag></div>}</div> },
    { title: labels.colCustomer, dataIndex: 'company_name', key: 'company_name', width: 160, render: (text: string) => <Text strong style={{ color: '#0f172a' }}>{text}</Text> },
    { title: labels.colSite, dataIndex: 'site_name', key: 'site_name', width: 150, render: (text: string) => <Tag color="geekblue">{text}</Tag> },
    {
      title: labels.colDetails,
      dataIndex: 'details',
      key: 'details',
      // NOTE: render 第一参数是 dataIndex 对应的字段值（details 数组）
      render: (details: any[]) => {
        const sortedDetails = [...(details || [])].sort((a, b) => {
          const left = getMealDisplayOrder(a.meal_section || '');
          const right = getMealDisplayOrder(b.meal_section || '');
          return left.group - right.group || left.item - right.item;
        });
        const groupedDetails = sortedDetails.reduce((groups: Record<number, any[]>, detail: any) => {
          const group = getMealDisplayOrder(detail.meal_section || '').group;
          groups[group] = [...(groups[group] || []), detail];
          return groups;
        }, {});

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(groupedDetails).map(([group, groupDetails], groupIndex) => (
              <div
                key={group}
                style={{
                  paddingTop: groupIndex === 0 ? 0 : 7,
                  borderTop: groupIndex === 0 ? 'none' : '1px dashed #e2e8f0',
                }}
              >
                <Tag color={Number(group) === 2 ? 'purple' : Number(group) === 1 ? 'cyan' : 'blue'} style={{ marginBottom: 4, fontSize: 11 }}>
                  {getMealGroupLabel(Number(group))}
                </Tag>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {groupDetails.map((d: any, idx: number) => (
                    <div key={d.id || idx} style={{ fontSize: 13 }}>
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
              </div>
            ))}
          </div>
        );
      }
    },
    { title: labels.colTotalPortions, dataIndex: 'total_portions', key: 'total_portions', width: 110, render: (val: number) => <Badge count={`${val} ${labels.portions}`} overflowCount={999} style={{ backgroundColor: '#dc2626' }} /> },
    { title: labels.colTotalPrice, dataIndex: 'total_price', key: 'total_price', width: 130, render: (val: number) => <Text strong style={{ color: '#dc2626' }}>RM {val.toFixed(2)}</Text> },
    {
      title: labels.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 145,
      align: 'center' as const,
      // NOTE: 加了 dataIndex='status'，render 第一参数为 status 值，第二参数为整行 record
      render: (_: string, record: any) => (
        <Select
          value={record.status}
          size="small"
          style={{ width: 105, textAlign: 'left' }}
          onChange={(val) => handleStatusChange(record.id, val)}
          disabled={record.status === 'cancelled' || record.status === 'paid'}
        >
          {availableStatusOptions(record.status).map((option) => (
            <Option key={option.value} value={option.value}>
              <Tag color={option.color}>{option.label}</Tag>
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: labels.colWhatsApp,
      dataIndex: 'whatsapp_delivery',
      key: 'whatsapp_delivery',
      width: 130,
      align: 'center' as const,
      render: (delivery: any) => renderWhatsAppStatus(delivery),
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 195,
      align: 'center' as const,
      // NOTE: 无 dataIndex 时，render 第一参数为 undefined，第二参数为整行 record
      render: (_: any, record: any) => (
        <Space size={6} style={{ justifyContent: 'center' }}>
          <Tooltip title={isEn ? 'View status and operation history' : '查看状态与操作历史'}>
            <Button
              size="small"
              shape="circle"
              icon={<HistoryOutlined />}
              onClick={() => handleOpenAuditDrawer(record)}
              aria-label={isEn ? 'View status and operation history' : '查看状态与操作历史'}
            />
          </Tooltip>
          <Tooltip title={labels.btnViewBill}>
            <Button
              size="small"
              shape="circle"
              icon={<FileTextOutlined />}
              style={{ color: '#2563eb', borderColor: '#93c5fd' }}
              onClick={() => setBillOrderId(record.id)}
              aria-label={labels.btnViewBill}
            />
          </Tooltip>
          <Tooltip title={labels.btnEdit}>
            <Button
              size="small"
              type="primary"
              ghost
              shape="circle"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(record)}
              disabled={['billed', 'paid', 'cancelled'].includes(record.status)}
              aria-label={labels.btnEdit}
            />
          </Tooltip>

          <Tooltip title={labels.btnWhatsAppResend}>
            <Button
              size="small"
              shape="circle"
              icon={<WhatsAppOutlined />}
              style={{ color: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => handleWhatsAppResend(record)}
              disabled={record.status === 'submitted'}
              aria-label={labels.btnWhatsAppResend}
            />
          </Tooltip>

          <Tooltip title={record.status === 'cancelled' ? labels.btnPermanentDelete : labels.btnDelete}>
            <Button
              size="small"
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteOrder(record)}
              disabled={['billed', 'paid'].includes(record.status)}
              aria-label={record.status === 'cancelled' ? labels.btnPermanentDelete : labels.btnDelete}
            />
          </Tooltip>
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
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>{labels.btnCreate}</Button>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null);
                }}
                allowClear
                placeholder={isEn ? ['Start date (optional)', 'End date (optional)'] : ['开始日期（选填）', '结束日期（选填）']}
              />
              <Select value={statusFilter} onChange={(val) => setStatusFilter(val)} style={{ width: 140 }}>
                <Option value="all">{labels.filterAll}</Option>
                <Option value="submitted">{labels.statusSubmitted}</Option>
                <Option value="confirmed">{labels.statusConfirmed}</Option>
                <Option value="in_production">{labels.statusInProduction}</Option>
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
        <div
          ref={tablePanRef}
          className="order-table-pan"
          onPointerDown={handleTablePointerDown}
          onPointerMove={handleTablePointerMove}
          onPointerUp={stopTablePan}
          onPointerCancel={stopTablePan}
        >
          <Table columns={columns} dataSource={filteredOrders} rowKey="id" loading={loading} scroll={{ x: 1700 }} />
        </div>

        <Modal
          title={labels.btnCreate}
          open={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          onOk={handleCreateOrder}
          okText={labels.btnSave}
          cancelText={labels.btnCancel}
          width={1080}
          styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
        >
          <Alert type="info" showIcon title={labels.createHint} style={{ marginBottom: 18, borderRadius: 10 }} />
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item label={labels.colCustomer} required>
                <Select value={createCustomerId} onChange={handleCreateCustomerChange} showSearch optionFilterProp="children" placeholder={isEn ? 'Select customer' : '请选择顾客'} style={{ width: '100%' }}>
                  {createCustomers.map(customer => <Option key={customer.id} value={customer.id}>{customer.company_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={labels.formDeliverySite} required>
                <Select value={createSiteId} onChange={setCreateSiteId} placeholder={isEn ? 'Select delivery site' : '请选择送货地址/分点'} style={{ width: '100%' }}>
                  {createSites.map(site => <Option key={site.id} value={site.id}>{site.site_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={labels.colDeliveryDate} required>
                <DatePicker value={createDate} onChange={(value) => value && setCreateDate(value)} allowClear={false} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 18px' }} />

          {!createCustomerId ? (
            <Empty description={isEn ? 'Select a customer to load the ordering menu.' : '请先选择顾客，系统将加载与顾客端相同的下单菜单。'} style={{ padding: '36px 0' }} />
          ) : createSections.length === 0 || createPackages.length === 0 ? (
            <Empty description={labels.emptyPackages} style={{ padding: '36px 0' }} />
          ) : (
            <Row gutter={[18, 18]}>
              <Col xs={24} lg={16}>
                <Row gutter={[14, 14]}>
                  {createSections.filter(section => getCreatePackagesForSection(section).length > 0).map(section => {
                    const sectionPackages = getCreatePackagesForSection(section);
                    const sectionTotal = sectionPackages.reduce((sum, pkg) => sum + getCreateQuantity(section.id, pkg.id), 0);
                    return (
                      <Col xs={24} md={12} key={section.id}>
                        <Card
                          size="small"
                          style={{ borderRadius: 14, height: '100%', border: sectionTotal > 0 ? '2px solid #10b981' : '1px solid #e2e8f0', background: sectionTotal > 0 ? '#f0fdf4' : '#fff' }}
                          styles={{ body: { padding: 16 } }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 12 }}>
                            <div>
                              <Text strong style={{ fontSize: 15 }}>{translateMealSection(section.name)}</Text>
                              <div><Text type="secondary" style={{ fontSize: 12 }}>{sectionTotal} {labels.portions}</Text></div>
                            </div>
                            {sectionTotal > 0 && <Tag color="success">{labels.selected}</Tag>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {sectionPackages.map(pkg => {
                              const quantity = getCreateQuantity(section.id, pkg.id);
                              const packageAddons = getCreateAddonsForPackage(pkg.id);
                              return (
                                <div key={pkg.id} style={{ padding: 11, borderRadius: 10, border: quantity > 0 ? '1px solid #10b981' : '1px solid #e2e8f0', background: quantity > 0 ? '#fff' : '#f8fafc' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                      <Text strong style={{ display: 'block', fontSize: 13 }}>{translatePackageTemplateName(pkg.template_name)}</Text>
                                      <Tag color="blue" style={{ marginTop: 4, fontSize: 11 }}>{pkg.category}</Tag>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: '#f1f5f9', padding: '2px 4px', borderRadius: 20 }}>
                                      <Button type="text" shape="circle" size="small" disabled={quantity <= 0} icon={<MinusOutlined />} onClick={() => setCreateQuantity(section.id, pkg.id, quantity - 1)} />
                                      <InputNumber min={0} max={9999} variant="borderless" controls={false} value={quantity} onChange={value => setCreateQuantity(section.id, pkg.id, value || 0)} style={{ width: 48, textAlign: 'center', fontWeight: 700 }} />
                                      <Button type="text" shape="circle" size="small" icon={<PlusOutlined />} onClick={() => setCreateQuantity(section.id, pkg.id, quantity + 1)} />
                                    </div>
                                  </div>
                                  {packageAddons.map(addon => {
                                    const addonKey = `package:${section.id}:${pkg.id}:${addon.id}`;
                                    const addonQuantity = createAddons[addonKey] || 0;
                                    return (
                                      <div key={addon.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 8, marginTop: 8 }}>
                                        <div><Text type="secondary" style={{ fontSize: 12 }}>{addon.addon_name}</Text><Text type="secondary" style={{ fontSize: 11, marginLeft: 5 }}>RM {Number(addon.agreement_price || 0).toFixed(2)}</Text></div>
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#fffbeb', padding: '1px 4px', borderRadius: 16 }}>
                                          <Button type="text" shape="circle" size="small" disabled={addonQuantity <= 0} icon={<MinusOutlined />} onClick={() => setCreateAddonQuantity(addonKey, addonQuantity - 1)} />
                                          <InputNumber min={0} max={999} variant="borderless" controls={false} value={addonQuantity} onChange={value => setCreateAddonQuantity(addonKey, value || 0)} style={{ width: 42, textAlign: 'center', fontWeight: 700 }} />
                                          <Button type="text" shape="circle" size="small" icon={<PlusOutlined />} onClick={() => setCreateAddonQuantity(addonKey, addonQuantity + 1)} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                {createCustomerAddons.some(addon => addon.is_customer_visible === false) && (
                  <Card size="small" title={isEn ? 'Admin-only Add-ons' : '后台另外加单'} style={{ marginTop: 14, borderRadius: 12, border: '1px solid #c4b5fd', background: '#faf5ff' }}>
                    <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                      {createCustomerAddons.filter(addon => addon.is_customer_visible === false).map(addon => {
                        const addonKey = `admin:${addon.id}`;
                        const quantity = createAddons[addonKey] || 0;
                        return (
                          <div key={addon.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) 150px auto', gap: 8, alignItems: 'center' }}>
                            <div><Text strong>{addon.addon_name}</Text><Text type="secondary" style={{ display: 'block', fontSize: 11 }}>RM {Number(addon.agreement_price || 0).toFixed(2)}</Text></div>
                            <Select size="small" value={createAdminAddonSections[addon.id]} onChange={sectionId => setCreateAdminAddonSections(current => ({ ...current, [addon.id]: sectionId }))} options={createSections.map(section => ({ value: section.id, label: translateMealSection(section.name) }))} />
                            <Space.Compact>
                              <Button size="small" disabled={quantity <= 0} icon={<MinusOutlined />} onClick={() => setCreateAddonQuantity(addonKey, quantity - 1)} />
                              <InputNumber size="small" min={0} controls={false} value={quantity} onChange={value => setCreateAddonQuantity(addonKey, value || 0)} style={{ width: 48 }} />
                              <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateAddonQuantity(addonKey, quantity + 1)} />
                            </Space.Compact>
                          </div>
                        );
                      })}
                    </Space>
                  </Card>
                )}
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" style={{ borderRadius: 14, position: 'sticky', top: 0 }} styles={{ body: { padding: 16 } }}>
                  <Text strong style={{ fontSize: 16 }}>{labels.orderSummary}</Text>
                  <Divider style={{ margin: '12px 0' }} />
                  {createItems.length === 0 && !Object.values(createAddons).some(quantity => quantity > 0) ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noItems} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {createItems.map(item => {
                        const section = createSections.find(value => value.id === item.meal_section_id);
                        const pkg = createPackages.find(value => value.id === item.customer_package_id);
                        const selectedAddons = getCreateAddonsForPackage(item.customer_package_id).flatMap(addon => {
                          const quantity = createAddons[`package:${item.meal_section_id}:${item.customer_package_id}:${addon.id}`] || 0;
                          return quantity > 0 ? [{ addon, quantity }] : [];
                        });
                        return (
                          <div key={`${item.meal_section_id}-${item.customer_package_id}`} style={{ background: '#f8fafc', borderRadius: 9, padding: '9px 10px' }}>
                            <Text strong style={{ display: 'block', fontSize: 12 }}>{translateMealSection(section?.name || '')}</Text>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{translatePackageTemplateName(pkg?.template_name || '')}</Text>
                              <Tag color="blue" style={{ margin: 0 }}>{item.quantity} {labels.portions}</Tag>
                            </div>
                            {selectedAddons.map(({ addon, quantity }) => (
                              <Text key={addon.id} style={{ color: '#b45309', fontSize: 11, display: 'block' }}>{addon.addon_name} +{quantity}</Text>
                            ))}
                          </div>
                        );
                      })}
                      {createCustomerAddons.filter(addon => addon.is_customer_visible === false && (createAddons[`admin:${addon.id}`] || 0) > 0).map(addon => (
                        <div key={`admin-${addon.id}`} style={{ background: '#faf5ff', borderRadius: 9, padding: '9px 10px' }}>
                          <Text strong style={{ fontSize: 12 }}>{addon.addon_name}</Text>
                          <Tag color="purple" style={{ float: 'right', margin: 0 }}>{createAddons[`admin:${addon.id}`]}</Tag>
                        </div>
                      ))}
                      {getCreatePackageAddonSelections().filter(({ section, pkg }) => getCreateQuantity(section.id, pkg.id) <= 0).map(({ section, pkg, addon, quantity }) => (
                        <div key={`package-addon-${section.id}-${pkg.id}-${addon.id}`} style={{ background: '#fffbeb', borderRadius: 9, padding: '9px 10px' }}>
                          <Text strong style={{ display: 'block', fontSize: 12 }}>{translateMealSection(section.name)}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{translatePackageTemplateName(pkg.template_name)} · {addon.addon_name}</Text>
                          <Tag color="orange" style={{ float: 'right', margin: 0 }}>{quantity} {labels.portions}</Tag>
                        </div>
                      ))}
                    </div>
                  )}
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{labels.totalPortions}</Text>
                    <Text strong style={{ color: '#10b981', fontSize: 22 }}>{createTotalPortions}</Text>
                  </div>
                  <Form.Item label={labels.orderRemark} style={{ marginTop: 14, marginBottom: 0 }}>
                    <Input.TextArea rows={3} value={createRemark} onChange={event => setCreateRemark(event.target.value)} placeholder={labels.orderRemarkPlaceholder} />
                  </Form.Item>
                </Card>
              </Col>
            </Row>
          )}
          <Form.Item label={labels.reason} required style={{ marginTop: 18 }}>
            <Input.TextArea rows={3} value={createReason} onChange={(event) => setCreateReason(event.target.value)} placeholder={labels.reasonPlaceholder} />
          </Form.Item>
        </Modal>

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
                        {item.customer_addon_id ? (
                          <Tag color="orange">{item.addon_name || (isEn ? 'Add-on' : '附加项')}</Tag>
                        ) : <Select
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
                          {getEditPackagesForSection(item)
                            .map(p => (
                              <Option key={p.id} value={p.id}>{translatePackageTemplateName(p.template_name)}</Option>
                            ))}
                        </Select>}
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
              <Form.Item label={labels.reason} required style={{ marginTop: 18, marginBottom: 0 }}>
                <Input.TextArea
                  rows={3}
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  placeholder={labels.reasonPlaceholder}
                />
              </Form.Item>
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
      <OrderBillModal
        orderId={billOrderId}
        open={billOrderId !== null}
        onClose={() => setBillOrderId(null)}
      />
    </>
  );
};
