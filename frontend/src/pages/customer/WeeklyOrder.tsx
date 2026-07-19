import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Modal, Alert, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface OrderHistoryProps {
  onEditOrder: (order: any) => void;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ onEditOrder }) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Order Status & Self-Edit Dashboard' : '订单状态与自助修改看板',
    btnRefresh: isEn ? 'Refresh Orders' : '刷新订单列表',
    loadFailed: isEn ? 'Failed to load order history' : '加载订单历史失败',
    cancelConfirmTitle: isEn ? 'Confirm Cancellation?' : '确认取消订单吗？',
    cancelConfirmContent: isEn ? 'Once cancelled, the order will be permanently deleted and the central kitchen will stop preparation.' : '取消后订单将被永久删除，中央厨房将停止该批伙食的配餐准备。',
    btnConfirmCancel: isEn ? 'Confirm Cancel' : '确认取消',
    btnThinkAgain: isEn ? 'Cancel' : '我再想想',
    msgCancelled: isEn ? 'Order cancelled successfully!' : '订单已成功取消！',
    msgCancelFailed: isEn ? 'Failed to cancel order. Please try again.' : '取消订单失败，请稍后重试',
    statusSubmitted: isEn ? 'Submitted' : '已提交',
    statusConfirmed: isEn ? 'Confirmed' : '已确认',
    statusInProduction: isEn ? 'In Production' : '生产中',
    statusDelivered: isEn ? 'Delivered' : '已送达',
    statusBilled: isEn ? 'Billed' : '已结账',
    statusCancelled: isEn ? 'Cancelled' : '已取消',
    colDeliveryDate: isEn ? 'Delivery Date' : '送餐日期',
    colSite: isEn ? 'Delivery Site / Factory' : '送餐分点/工厂',
    colDetails: isEn ? 'Order Details' : '预订明细内容',
    pax: isEn ? 'pax' : '人',
    remarkLabel: isEn ? 'Remark: ' : '备注: ',
    colOrderRemark: isEn ? 'Order Remark' : '订单备注',
    none: isEn ? 'None' : '无',
    colOrderStatus: isEn ? 'Order Status' : '订单状态',
    colAction: isEn ? 'Actions' : '操作',
    btnEdit: isEn ? 'Edit' : '修改',
    btnCancel: isEn ? 'Cancel' : '取消',
    tooltipModify: isEn ? 'Modify portions or packages' : '修改订单份数或套餐',
    tooltipNoModify: isEn ? 'Order in process, cannot modify' : '订单已在处理中，不可修改',
    tooltipCancel: isEn ? 'Cancel and delete order' : '取消并删除该订单',
    tooltipNoCancel: isEn ? 'Order in process, cannot cancel' : '订单已在处理中，不可取消',
    policyTitle: isEn ? 'Ordering Policy' : '温馨订餐提示',
    policyDesc: isEn ? 'Only orders in "Submitted" status can be modified or cancelled. For orders in "Confirmed", "In Production", or "Delivered" status, please contact customer service for urgent adjustments.' : '系统仅支持对状态为【已提交 (submitted)】的订单进行直接修改或自主取消。若订单状态变更为【已确认】、【生产中】或【已配送】，表示中央厨房已备餐或处于装车派送中，如需紧急微调，请致电客服热线进行人工干预。',
  };

  const [userInfo, setUserInfo] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      setUserInfo(u);
      fetchOrders(u.customer_id);
    }
  }, []);

  const fetchOrders = async (customerId: number) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/admin/all-orders?customer_id=${customerId}`);
      setOrders(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = (orderId: number) => {
    Modal.confirm({
      title: labels.cancelConfirmTitle,
      content: labels.cancelConfirmContent,
      okText: labels.btnConfirmCancel,
      okType: 'danger',
      cancelText: labels.btnThinkAgain,
      onOk: async () => {
        try {
          await axiosInstance.delete(`/admin/orders/${orderId}`);
          message.success(labels.msgCancelled);
          if (userInfo) {
            fetchOrders(userInfo.customer_id);
          }
        } catch (err) {
          message.error(labels.msgCancelFailed);
        }
      }
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusSubmitted}</Tag>;
      case 'confirmed':
        return <Tag color="orange" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusConfirmed}</Tag>;
      case 'in_production':
        return <Tag color="purple" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusInProduction}</Tag>;
      case 'delivered':
        return <Tag color="green" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusDelivered}</Tag>;
      case 'billed':
        return <Tag color="default" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusBilled}</Tag>;
      case 'cancelled':
        return <Tag color="error" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{labels.statusCancelled}</Tag>;
      default:
        return <Tag style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>{status}</Tag>;
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

  const columns = [
    {
      title: labels.colDeliveryDate,
      dataIndex: 'delivery_date',
      key: 'delivery_date',
      width: 130,
      render: (text: string) => <Text bold style={{ fontSize: 14 }}>{text}</Text>
    },
    {
      title: labels.colSite,
      dataIndex: 'site_name',
      key: 'site_name',
      width: 160,
      render: (text: string) => <Text style={{ color: '#334155' }}>{text}</Text>
    },
    {
      title: labels.colDetails,
      dataIndex: 'details',
      key: 'details',
      render: (details: any[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(details || []).map((d: any) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>🍽️</span>
              <Text bold style={{ fontSize: 13, minWidth: 80 }}>{translateMealSection(d.meal_section)}:</Text>
              <Text style={{ fontSize: 13, color: '#475569' }}>
                {translatePackageTemplateName(d.package_name || d.template_name)} <strong style={{ color: '#2563eb' }}>x {d.quantity}</strong> {labels.pax}
              </Text>
              {d.remark && (
                <Tag color="warning" style={{ fontSize: 11, margin: 0 }}>
                  {labels.remarkLabel} {d.remark}
                </Tag>
              )}
            </div>
          ))}
        </div>
      )
    },
    {
      title: labels.colOrderRemark,
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      render: (text: string) => <Text type="secondary" style={{ fontSize: 13 }}>{text || labels.none}</Text>
    },
    {
      title: labels.colOrderStatus,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: labels.colAction,
      key: 'action',
      width: 160,
      render: (_: any, record: any) => {
        const canModify = record.status === 'submitted';
        return (
          <Space size="middle">
            <Tooltip title={canModify ? labels.tooltipModify : labels.tooltipNoModify}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                disabled={!canModify}
                onClick={() => onEditOrder(record)}
                style={{ borderRadius: 6 }}
              >
                {labels.btnEdit}
              </Button>
            </Tooltip>
            <Tooltip title={canModify ? labels.tooltipCancel : labels.tooltipNoCancel}>
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                disabled={!canModify}
                onClick={() => handleCancelOrder(record.id)}
                style={{ borderRadius: 6 }}
              >
                {labels.btnCancel}
              </Button>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>📋 {labels.title}</Title>
          <Button type="primary" onClick={() => userInfo && fetchOrders(userInfo.customer_id)}>
            {labels.btnRefresh}
          </Button>
        </div>
      }
      style={{ width: '100%', borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
    >
      <Alert
        message={labels.policyTitle}
        description={labels.policyDesc}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      <Table
        dataSource={orders}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
        style={{ borderRadius: 8 }}
      />
    </Card>
  );
};
