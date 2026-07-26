import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Input, Select, Typography, Tag, Space, Button, Spin, Empty,
  Pagination, Badge, Tooltip, Row, Col
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, ShoppingCartOutlined, FormOutlined,
  DeleteFilled, SwapOutlined, HistoryOutlined, AuditOutlined
} from '@ant-design/icons';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 操作类型配置表
 * 定义每种操作的图标、颜色、标签等视觉属性
 */
const ACTION_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  labelEn: string;
}> = {
  ORDER_CREATE: {
    icon: <ShoppingCartOutlined />,
    color: '#16a34a',
    bg: '#f0fdf4',
    label: 'ORDER CREATE',
    labelEn: 'ORDER CREATE',
  },
  ORDER_UPDATE: {
    icon: <FormOutlined />,
    color: '#d97706',
    bg: '#fffbeb',
    label: 'ORDER UPDATE',
    labelEn: 'ORDER UPDATE',
  },
  ORDER_DELETE: {
    icon: <DeleteFilled />,
    color: '#dc2626',
    bg: '#fef2f2',
    label: 'ORDER DELETE',
    labelEn: 'ORDER DELETE',
  },
  ORDER_STATUS_CHANGE: {
    icon: <SwapOutlined />,
    color: '#2563eb',
    bg: '#eff6ff',
    label: 'ORDER STATUS CHANGE',
    labelEn: 'ORDER STATUS CHANGE',
  },
  CUSTOMER_UPDATE: {
    icon: <FormOutlined />,
    color: '#7c3aed',
    bg: '#f5f3ff',
    label: 'CUSTOMER UPDATE',
    labelEn: 'CUSTOMER UPDATE',
  },
};

const PAGE_SIZE = 12;

/** 审计日志全页（仅 superadmin 可见） */
export const AuditLog: React.FC = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [actionType, setActionType] = useState('all');

  const labels = {
    title: isEn ? 'System Audit Log' : '系统审计日志',
    subtitle: isEn
      ? 'Track all operations across the system for security and compliance.'
      : '追踪系统每一个角色的关键操作，确保数据安全与追踪可见。',
    total: isEn ? 'Total Records' : '总记录数',
    search: isEn ? 'Search by description or operator...' : '搜索日志描述、操作对象 ID 或操作人...',
    allActions: isEn ? 'All Operations' : '全部操作',
    refresh: isEn ? 'Refresh' : '刷新',
    operator: isEn ? 'Operator' : '操作人',
    online: isEn ? 'Live' : '实时',
  };

  /**
   * 从后端拉取全局审计日志（分页）
   * NOTE: 当前后端没有实现全局分页 API，改为拉取全部再前端分页
   */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // 拉取全部日志，通过 action_type 和 keyword 过滤
      // NOTE: 此处调用通用审计日志列表接口，后端返回所有类型的操作记录
      const res = await axiosInstance.get('/admin/audit-logs', {
        params: {
          action_type: actionType !== 'all' ? actionType : undefined,
          keyword: keyword || undefined,
          page: currentPage,
          page_size: PAGE_SIZE,
        },
      });
      setLogs(res.data.items ?? res.data ?? []);
      setTotalCount(res.data.total ?? (res.data?.length ?? 0));
    } catch {
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [actionType, keyword, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 切换过滤条件时重置到第 1 页
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const getRoleLabel = (role: string) => {
    if (role === 'superadmin') return isEn ? 'Super Admin' : '超级管理员';
    if (role === 'staff') return isEn ? 'Staff' : '管理员';
    if (role === 'customer') return isEn ? 'Customer' : '客户';
    return role;
  };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* ─── 页面顶部标题区 ─── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 24px rgba(37,99,235,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: '#fff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            <AuditOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 800 }}>
              {labels.title}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              {labels.subtitle}
            </Text>
          </div>
        </div>

        {/* 总记录数与实时指示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge
            status="processing"
            text={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>{labels.online}</span>}
          />
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '8px 20px',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              textAlign: 'center',
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{labels.total}</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
              {totalCount.toLocaleString()}
            </div>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchLogs}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              borderRadius: 8,
            }}
          >
            {labels.refresh}
          </Button>
        </div>
      </div>

      {/* ─── 搜索与过滤 ─── */}
      <Card
        style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={12} align="middle">
          <Col flex="1">
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder={labels.search}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                handleFilterChange();
              }}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col>
            <Select
              value={actionType}
              onChange={(val) => {
                setActionType(val);
                handleFilterChange();
              }}
              style={{ width: 180, borderRadius: 8 }}
            >
              <Option value="all">{labels.allActions}</Option>
              <Option value="ORDER_CREATE">ORDER CREATE</Option>
              <Option value="ORDER_UPDATE">ORDER UPDATE</Option>
              <Option value="ORDER_DELETE">ORDER DELETE</Option>
              <Option value="ORDER_STATUS_CHANGE">ORDER STATUS CHANGE</Option>
              <Option value="CUSTOMER_UPDATE">CUSTOMER UPDATE</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* ─── 日志卡片网格 ─── */}
      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      ) : logs.length === 0 ? (
        <Empty
          icon={<HistoryOutlined style={{ fontSize: 48, color: '#94a3b8' }} />}
          description={isEn ? 'No audit logs found' : '暂无审计日志记录'}
          style={{ marginTop: 80 }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {logs.map((log) => {
              const cfg = ACTION_CONFIG[log.action_type] ?? {
                icon: <HistoryOutlined />,
                color: '#64748b',
                bg: '#f8fafc',
                label: log.action_type,
                labelEn: log.action_type,
              };

              return (
                <Col key={log.id} xs={24} sm={12} lg={8}>
                  <Card
                    style={{
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      cursor: 'default',
                    }}
                    bodyStyle={{ padding: '18px 20px' }}
                    hoverable
                  >
                    {/* 卡片顶部：图标 + 时间 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: cfg.bg,
                          border: `1.5px solid ${cfg.color}30`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          color: cfg.color,
                        }}
                      >
                        {cfg.icon}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        时间戳 {log.created_at?.slice(11, 16)}
                      </Text>
                    </div>

                    {/* 操作描述 */}
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 10, lineHeight: 1.5 }}>
                      {log.description}
                    </div>

                    {/* 操作类型 Tag + 日期 Tag */}
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Tag
                        style={{
                          background: cfg.bg,
                          color: cfg.color,
                          border: `1px solid ${cfg.color}40`,
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: '0.5px',
                          padding: '1px 8px',
                        }}
                      >
                        {cfg.label}
                      </Tag>
                      {log.created_at && (
                        <Tag
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            fontSize: 10,
                            padding: '1px 8px',
                          }}
                        >
                          {log.created_at?.slice(0, 10)}
                        </Tag>
                      )}
                    </Space>

                    {/* 操作人 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: '#fff',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {log.operator_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1 }}>
                            {labels.operator}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {log.operator_name}
                          </div>
                        </div>
                      </div>

                      {/* JSON 详情按钮（可扩展） */}
                      <Tooltip title={log.extra_data ?? (isEn ? 'No extra data' : '无附加数据')}>
                        <Button
                          type="text"
                          size="small"
                          style={{ color: '#94a3b8', fontSize: 12, padding: '0 4px' }}
                        >
                          {'{ }'}
                        </Button>
                      </Tooltip>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* 分页 */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
              showTotal={(total) => (isEn ? `Total ${total} records` : `共 ${total} 条记录`)}
            />
          </div>
        </>
      )}
    </div>
  );
};
