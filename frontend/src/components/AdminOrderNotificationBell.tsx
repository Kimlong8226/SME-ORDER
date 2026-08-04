import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Badge, Button, Empty, List, Popover, Space, Tag, Tooltip, Typography } from 'antd';
import { BellOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../api/axiosInstance';

const { Text } = Typography;

interface OrderNotificationItem {
  id: number;
  do_number: string;
  company_name: string;
  site_name: string;
  delivery_date: string;
  status: string;
  created_at: string;
}

interface OrderNotificationResponse {
  latest_order_id: number;
  unread_count: number;
  orders: OrderNotificationItem[];
}

interface AdminOrderNotificationBellProps {
  currentUser: {
    username?: string;
    name?: string;
  };
  onNavigate: (menuKey: string) => void;
}

const readSeenOrderId = (key: string): number | null => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return null;
    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const writeSeenOrderId = (key: string, orderId: number) => {
  try {
    localStorage.setItem(key, String(orderId));
  } catch {
    // The in-memory marker below still keeps notifications correct for this tab.
  }
};

export const AdminOrderNotificationBell: React.FC<AdminOrderNotificationBellProps> = ({ currentUser, onNavigate }) => {
  const { notification } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [orders, setOrders] = useState<OrderNotificationItem[]>([]);
  const latestOrderIdRef = useRef(0);
  const seenOrderIdRef = useRef<number | null>(null);
  const pollingRef = useRef(false);

  const storageKey = `admin_order_notification_seen:v1:${currentUser.username || currentUser.name || 'staff'}`;

  const labels = {
    title: isEn ? 'New order notifications' : '新订单通知',
    empty: isEn ? 'No unread orders' : '暂无未读新订单',
    markAllRead: isEn ? 'Mark all read' : '全部标记已读',
    viewOrders: isEn ? 'View order status' : '查看订单状态',
    bell: isEn ? 'New order notifications' : '新订单提醒',
    delivery: isEn ? 'Delivery' : '送餐',
    more: (count: number) => isEn ? `${count} more unread orders` : `另有 ${count} 张未读订单`,
    arrived: (count: number) => isEn ? `${count} new order${count > 1 ? 's' : ''} received` : `收到 ${count} 张新订单`,
  };

  const markAllAsRead = useCallback(() => {
    seenOrderIdRef.current = latestOrderIdRef.current;
    writeSeenOrderId(storageKey, latestOrderIdRef.current);
    setUnreadCount(0);
    setOrders([]);
  }, [storageKey]);

  const openOrderStatus = useCallback(() => {
    markAllAsRead();
    setOpen(false);
    onNavigate('orderStatus');
  }, [markAllAsRead, onNavigate]);

  useEffect(() => {
    let cancelled = false;

    const checkForNewOrders = async (isInitialCheck: boolean) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      if (isInitialCheck) setLoading(true);

      try {
        const persistedSeenId = readSeenOrderId(storageKey);
        const seenId = persistedSeenId ?? seenOrderIdRef.current;
        if (seenId !== null) seenOrderIdRef.current = seenId;
        const response = await axiosInstance.get<OrderNotificationResponse>('/admin/order-notifications', {
          params: seenId === null ? undefined : { after_id: seenId, limit: 10 },
        });
        if (cancelled) return;

        const data = response.data;
        const latestOrderId = Number(data.latest_order_id || 0);
        const previousLatestOrderId = latestOrderIdRef.current;

        if (seenId === null || seenId > latestOrderId) {
          seenOrderIdRef.current = latestOrderId;
          writeSeenOrderId(storageKey, latestOrderId);
          latestOrderIdRef.current = latestOrderId;
          setUnreadCount(0);
          setOrders([]);
          return;
        }

        latestOrderIdRef.current = latestOrderId;
        setUnreadCount(Number(data.unread_count || 0));
        setOrders(data.orders || []);

        if (!isInitialCheck && latestOrderId > previousLatestOrderId) {
          const newlyArrived = (data.orders || []).filter((order) => order.id > previousLatestOrderId);
          const newestOrder = data.orders?.[0];
          const arrivalCount = Math.max(newlyArrived.length, 1);
          notification.info({
            message: labels.arrived(arrivalCount),
            description: newestOrder
              ? `${newestOrder.company_name} · ${newestOrder.site_name || '-'} · ${labels.delivery} ${newestOrder.delivery_date}`
              : labels.viewOrders,
            icon: <BellOutlined style={{ color: '#16a34a' }} />,
            placement: 'topRight',
            duration: 8,
            onClick: openOrderStatus,
          });
        }
      } catch (error) {
        // Keep the bell quiet during transient network or deployment restarts;
        // the next scheduled check will recover without losing the seen marker.
        console.warn('Failed to check new order notifications', error);
      } finally {
        pollingRef.current = false;
        if (!cancelled && isInitialCheck) setLoading(false);
      }
    };

    void checkForNewOrders(true);
    const intervalId = window.setInterval(() => void checkForNewOrders(false), 20_000);
    const handleVisibilityChange = () => {
      if (!document.hidden) void checkForNewOrders(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isEn, notification, openOrderStatus, storageKey]);

  const popoverContent = (
    <div style={{ width: 340, maxWidth: 'calc(100vw - 40px)' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>{labels.title}</Text>
        <Button type="link" size="small" disabled={unreadCount === 0} onClick={markAllAsRead}>
          {labels.markAllRead}
        </Button>
      </Space>

      {orders.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.empty} style={{ margin: '18px 0' }} />
      ) : (
        <List
          size="small"
          dataSource={orders}
          style={{ maxHeight: 360, overflowY: 'auto' }}
          renderItem={(order) => (
            <List.Item onClick={openOrderStatus} style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
              <List.Item.Meta
                title={
                  <Space size={6} wrap>
                    <Text strong>{order.company_name}</Text>
                    <Tag color="green">{order.do_number || `#${order.id}`}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">{order.site_name || '-'}</Text>
                    <Text type="secondary">{labels.delivery} {order.delivery_date} · {order.created_at}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      {unreadCount > orders.length && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {labels.more(unreadCount - orders.length)}
        </Text>
      )}

      <Button block icon={<UnorderedListOutlined />} onClick={openOrderStatus} style={{ marginTop: 12 }}>
        {labels.viewOrders}
      </Button>
    </div>
  );

  return (
    <Popover content={popoverContent} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
      <Tooltip title={labels.bell}>
        <Badge count={unreadCount} overflowCount={99} size="small">
          <Button
            icon={<BellOutlined />}
            type="text"
            shape="circle"
            size="large"
            loading={loading}
            aria-label={labels.bell}
          />
        </Badge>
      </Tooltip>
    </Popover>
  );
};
