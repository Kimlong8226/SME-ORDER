import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Popconfirm,
  App,
  Tag,
  Select,
  Tooltip,
  Badge,
  Alert,
  Divider,
  Empty
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SunOutlined,
  MoonOutlined,
  CoffeeOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text, Paragraph } = Typography;

// 常用餐次预设模版，方便用户一键极速快捷创建
const PRESET_TEMPLATES = [
  { name: '早班早餐', sort_order: 10, categories: ['饭盒', '早点'], icon: '🌅', color: '#f59e0b' },
  { name: '早班午餐', sort_order: 20, categories: ['饭盒', '大型供餐', 'Buffet'], icon: '☀️', color: '#10b981' },
  { name: '下午茶点', sort_order: 30, categories: ['茶点', 'Buffet'], icon: '☕', color: '#8b5cf6' },
  { name: '晚班晚餐', sort_order: 40, categories: ['饭盒', 'Buffet'], icon: '🌆', color: '#ec4899' },
  { name: '深夜宵夜', sort_order: 50, categories: ['饭盒', '宵夜'], icon: '🌙', color: '#6366f1' }
];

// 常用套餐分类推荐标签
const COMMON_CATEGORIES = ['饭盒', '大型供餐', 'Buffet', '茶点', '清真餐', '早点', '宵夜', '高管桌餐'];

export const MealSectionsManagement: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Meal Shifts & Schedule Management' : '餐次与排班管理',
    subtitle: isEn ? 'Configure meal section ordering, display sequence, and bound menu package categories.' : '灵活配置订餐系统各时段餐次定义、前端展示顺序及对应可订套餐分类。',
    colName: isEn ? 'Shift Name & Type' : '餐次名称',
    colSort: isEn ? 'Sort & Order' : '前端排序',
    colCategories: isEn ? 'Bound Categories' : '关联套餐分类 (下单可选)',
    colAction: isEn ? 'Actions' : '操作',
    btnAdd: isEn ? 'Add Meal Shift' : '新增餐次定义',
    btnPresets: isEn ? 'Quick Add Presets' : '一键预设餐次',
    btnEdit: isEn ? 'Edit' : '编辑',
    btnDelete: isEn ? 'Delete' : '删除',
    modalAddTitle: isEn ? 'Add New Meal Shift' : '✨ 添加餐次定义',
    modalEditTitle: isEn ? 'Edit Meal Shift' : '✏️ 修改餐次配置',
    formName: isEn ? 'Shift Name' : '餐次名称',
    formSort: isEn ? 'Display Order' : '排序权重 (数字越小越靠前)',
    formCategories: isEn ? 'Allowed Categories' : '关联套餐分类',
    searchPlaceholder: isEn ? 'Search shift name or category...' : '搜索餐次名称、分类关键字...',
    confirmDelete: isEn ? 'Are you sure you want to delete this shift?' : '确定要删除该餐次定义吗？已绑定的历史订单不受影响。',
    saveSuccess: isEn ? 'Saved successfully!' : '餐次配置已成功保存！',
    deleteSuccess: isEn ? 'Deleted successfully!' : '已成功删除该餐次！',
    loadFailed: isEn ? 'Failed to load meal shifts' : '获取餐次列表失败',
    sortSuccess: isEn ? 'Sort order updated!' : '排序已快捷调整！'
  };

  const [sections, setSections] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(COMMON_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  
  const [form] = Form.useForm();
  
  // 监听 Form 中的表单值，用于模态框内的实时预览
  const formCategoriesValue = Form.useWatch('allowed_categories', form);
  const formNameValue = Form.useWatch('name', form);

  // 获取餐次列表数据
  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/meal-sections');
      const sorted = (res.data || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      setSections(sorted);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  // 尝试从后台套餐数据中动态提取已有的分类列表
  const fetchAvailableCategories = async () => {
    try {
      const res = await axiosInstance.get('/admin/packages');
      if (res.data && Array.isArray(res.data)) {
        const extracted = Array.from(new Set(res.data.map((p: any) => p.category).filter(Boolean))) as string[];
        const merged = Array.from(new Set([...COMMON_CATEGORIES, ...extracted]));
        setAvailableCategories(merged);
      }
    } catch (e) {
      // 降级使用默认预设分类列表
    }
  };

  useEffect(() => {
    fetchSections();
    fetchAvailableCategories();
  }, []);

  // 过滤后的列表
  const filteredSections = useMemo(() => {
    if (!searchText.trim()) return sections;
    const term = searchText.toLowerCase().trim();
    return sections.filter((s) => 
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.allowed_categories && s.allowed_categories.toLowerCase().includes(term))
    );
  }, [sections, searchText]);

  // 打开新增弹窗
  const handleOpenAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    // 自动给出合理的下一位排序值
    const maxSort = sections.reduce((max, item) => Math.max(max, item.sort_order || 0), 0);
    form.setFieldsValue({
      sort_order: maxSort + 10,
      allowed_categories: []
    });
    setModalVisible(true);
  };

  // 一键插入预设餐次
  const handleApplyPreset = async (preset: typeof PRESET_TEMPLATES[0]) => {
    try {
      setLoading(true);
      await axiosInstance.post('/admin/meal-sections', {
        name: preset.name,
        sort_order: preset.sort_order,
        allowed_categories: preset.categories.join(',')
      });
      message.success(`已一键添加预设餐次: ${preset.name}`);
      fetchSections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '添加预设失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开编辑弹窗
  const handleOpenEditModal = (record: any) => {
    setEditingItem(record);
    const catArray = record.allowed_categories
      ? record.allowed_categories.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];
    form.setFieldsValue({
      name: record.name,
      sort_order: record.sort_order,
      allowed_categories: catArray
    });
    setModalVisible(true);
  };

  // 保存提交
  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const payload = {
        name: vals.name,
        sort_order: vals.sort_order,
        allowed_categories: Array.isArray(vals.allowed_categories)
          ? vals.allowed_categories.join(',')
          : vals.allowed_categories || ''
      };

      if (editingItem) {
        await axiosInstance.put(`/admin/meal-sections/${editingItem.id}`, payload);
      } else {
        await axiosInstance.post('/admin/meal-sections', payload);
      }
      message.success(labels.saveSuccess);
      setModalVisible(false);
      fetchSections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '保存失败，请检查输入');
    }
  };

  // 删除
  const handleDelete = async (id: number) => {
    try {
      await axiosInstance.delete(`/admin/meal-sections/${id}`);
      message.success(labels.deleteSuccess);
      fetchSections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
    }
  };

  // 快捷调整上下排序
  const handleMoveOrder = async (record: any, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === record.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const targetRecord = sections[targetIndex];
    // 交换两个记录的 sort_order
    try {
      const newSortCurrent = targetRecord.sort_order || (targetIndex * 10);
      const newSortTarget = record.sort_order || (currentIndex * 10);

      await Promise.all([
        axiosInstance.put(`/admin/meal-sections/${record.id}`, {
          name: record.name,
          sort_order: newSortCurrent,
          allowed_categories: record.allowed_categories
        }),
        axiosInstance.put(`/admin/meal-sections/${targetRecord.id}`, {
          name: targetRecord.name,
          sort_order: newSortTarget,
          allowed_categories: targetRecord.allowed_categories
        })
      ]);

      message.success(labels.sortSuccess);
      fetchSections();
    } catch (err) {
      message.error('调整排序失败');
    }
  };

  // 智能识别餐次图标与调色盘
  const getShiftTheme = (name: string) => {
    if (/早/i.test(name)) return { icon: '🌅', tagColor: 'gold', badgeBg: '#fef3c7', textColor: '#b45309' };
    if (/午/i.test(name)) return { icon: '☀️', tagColor: 'green', badgeBg: '#dcfce7', textColor: '#15803d' };
    if (/茶|下午/i.test(name)) return { icon: '☕', tagColor: 'purple', badgeBg: '#f3e8ff', textColor: '#7e22ce' };
    if (/晚/i.test(name)) return { icon: '🌆', tagColor: 'volcano', badgeBg: '#ffedd5', textColor: '#c2410c' };
    if (/夜|宵/i.test(name)) return { icon: '🌙', tagColor: 'geekblue', badgeBg: '#e0e7ff', textColor: '#4338ca' };
    return { icon: '🍽️', tagColor: 'blue', badgeBg: '#e0f2fe', textColor: '#0369a1' };
  };

  // 统计面板指标计算
  const stats = useMemo(() => {
    const total = sections.length;
    const configured = sections.filter(s => s.allowed_categories && s.allowed_categories.trim() !== '').length;
    const allCats = new Set<string>();
    sections.forEach(s => {
      if (s.allowed_categories) {
        s.allowed_categories.split(',').forEach((c: string) => {
          if (c.trim()) allCats.add(c.trim());
        });
      }
    });
    return { total, configured, unconfigured: total - configured, categoriesCount: allCats.size };
  }, [sections]);

  // 表格列定义
  const columns = [
    {
      title: labels.colSort,
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 130,
      render: (val: number, record: any, index: number) => (
        <Space size={4}>
          <Tag 
            style={{ 
              borderRadius: 12, 
              padding: '2px 10px', 
              fontWeight: 700, 
              fontSize: 13,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1'
            }}
          >
            #{val}
          </Tag>
          <Space.Compact size="small">
            <Tooltip title="向上移">
              <Button
                type="text"
                size="small"
                icon={<ArrowUpOutlined style={{ fontSize: 11 }} />}
                disabled={index === 0}
                onClick={() => handleMoveOrder(record, 'up')}
                style={{ borderRadius: 4, width: 24, height: 24, color: index === 0 ? '#cbd5e1' : '#64748b' }}
              />
            </Tooltip>
            <Tooltip title="向下移">
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined style={{ fontSize: 11 }} />}
                disabled={index === sections.length - 1}
                onClick={() => handleMoveOrder(record, 'down')}
                style={{ borderRadius: 4, width: 24, height: 24, color: index === sections.length - 1 ? '#cbd5e1' : '#64748b' }}
              />
            </Tooltip>
          </Space.Compact>
        </Space>
      )
    },
    {
      title: labels.colName,
      dataIndex: 'name',
      key: 'name',
      render: (t: string) => {
        const theme = getShiftTheme(t);
        return (
          <Space align="center" size="middle">
            <span 
              style={{ 
                fontSize: 20, 
                width: 36, 
                height: 36, 
                borderRadius: 10, 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: theme.badgeBg,
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
              }}
            >
              {theme.icon}
            </span>
            <div>
              <Text strong style={{ fontSize: 15, color: '#0f172a', display: 'block' }}>{t}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>预订时段标识</Text>
            </div>
          </Space>
        );
      }
    },
    {
      title: labels.colCategories,
      dataIndex: 'allowed_categories',
      key: 'allowed_categories',
      render: (t: string, record: any) => {
        if (!t || !t.trim()) {
          return (
            <Tooltip title="未配置关联分类的餐次，客户在前台下单页面将无法选购任何套餐。点击【编辑】以绑定套餐分类。">
              <Tag icon={<ExclamationCircleOutlined />} color="warning" style={{ borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }} onClick={() => handleOpenEditModal(record)}>
                {isEn ? 'No Categories (Hidden)' : '未配置分类 (下单页隐藏)'}
              </Tag>
            </Tooltip>
          );
        }

        const categories = t.split(',').map(c => c.trim()).filter(Boolean);
        return (
          <Space size={[4, 6]} wrap align="center">
            {categories.map((cat, idx) => (
              <Tag 
                key={idx} 
                color="geekblue"
                style={{ 
                  borderRadius: 12, 
                  padding: '2px 10px', 
                  fontSize: 12, 
                  fontWeight: 500,
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1e40af'
                }}
              >
                <TagsOutlined style={{ marginRight: 4, fontSize: 10 }} />
                {cat}
              </Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: labels.colAction,
      key: 'action',
      width: 170,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary" 
            ghost 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEditModal(record)}
            style={{ borderRadius: 6, fontWeight: 500 }}
          >
            {labels.btnEdit}
          </Button>
          <Popconfirm
            title={labels.confirmDelete}
            onConfirm={() => handleDelete(record.id)}
            okText={isEn ? 'Delete' : '确定删除'}
            cancelText={isEn ? 'Cancel' : '取消'}
            okButtonProps={{ danger: true, style: { borderRadius: 6 } }}
            cancelButtonProps={{ style: { borderRadius: 6 } }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>
              {labels.btnDelete}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 24 }}>
      {/* 顶部页头 banner */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)'
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="start" size="middle">
              <span style={{ fontSize: 32, lineHeight: 1 }}>⏱️</span>
              <div>
                <Title level={3} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
                  {labels.title}
                </Title>
                <Paragraph style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: 13 }}>
                  {labels.subtitle}
                </Paragraph>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                onClick={handleOpenAddModal}
                style={{
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderColor: '#10b981',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {labels.btnAdd}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 关键指标概览面板 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>总餐次定义</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', color: '#0f172a' }}>{stats.total}</Title>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>已绑定分类餐次</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', color: '#16a34a' }}>{stats.configured}</Title>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>未配置/隐藏餐次</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', color: stats.unconfigured > 0 ? '#ea580c' : '#64748b' }}>
              {stats.unconfigured}
            </Title>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>关联套餐分类总数</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', color: '#2563eb' }}>{stats.categoriesCount}</Title>
          </Card>
        </Col>
      </Row>

      {/* 极速预设餐次工具栏 */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          background: '#f8fafc',
          marginBottom: 20,
          border: '1px solid #e2e8f0'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row align="middle" justify="space-between" gutter={[12, 12]}>
          <Col xs={24} md={14}>
            <Space align="center" wrap>
              <Text strong style={{ color: '#475569', fontSize: 13 }}>
                <ThunderboltOutlined style={{ color: '#f59e0b', marginRight: 4 }} />
                {labels.btnPresets}:
              </Text>
              {PRESET_TEMPLATES.map((tmpl) => {
                const isExist = sections.some(s => s.name === tmpl.name);
                return (
                  <Tooltip key={tmpl.name} title={isExist ? '该餐次已在列表中存在' : `一键快速添加【${tmpl.name}】`}>
                    <Button
                      size="small"
                      disabled={isExist}
                      onClick={() => handleApplyPreset(tmpl)}
                      style={{
                        borderRadius: 20,
                        fontSize: 12,
                        borderColor: isExist ? '#cbd5e1' : '#cbd5e1',
                        background: isExist ? '#f1f5f9' : '#ffffff',
                        color: isExist ? '#94a3b8' : '#334155'
                      }}
                    >
                      {tmpl.icon} {tmpl.name} {isExist && <CheckCircleOutlined style={{ color: '#10b981' }} />}
                    </Button>
                  </Tooltip>
                );
              })}
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Space size="middle" style={{ width: '100%', justifyItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Input
                placeholder={labels.searchPlaceholder}
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ width: 240, borderRadius: 8 }}
              />
              <Tooltip title="刷新列表">
                <Button icon={<ReloadOutlined />} onClick={fetchSections} style={{ borderRadius: 8 }} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 餐次表格列表 */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          background: '#ffffff'
        }}
        bodyStyle={{ padding: '0 0 16px 0' }}
      >
        <Table
          dataSource={filteredSections}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条餐次规则` }}
          locale={{ emptyText: <Empty description="暂无餐次数据，点击右上角新建或点选快捷预设" /> }}
        />
      </Card>

      {/* 新增 / 编辑餐次弹窗 */}
      <Modal
        title={editingItem ? labels.modalEditTitle : labels.modalAddTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        destroyOnHidden
        width={560}
        okText={editingItem ? '更新餐次' : '确认添加'}
        cancelText="取消"
        okButtonProps={{
          style: {
            borderRadius: 8,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderColor: '#10b981'
          }
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Divider style={{ margin: '12px 0 20px 0' }} />
        
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={15}>
              <Form.Item
                name="name"
                label={labels.formName}
                rules={[{ required: true, message: '请输入餐次名称 (例如: 早班早餐)' }]}
              >
                <Input placeholder="例如: 早班早餐 / 晚班晚餐 / 下午茶点" maxLength={30} style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item
                name="sort_order"
                label={labels.formSort}
                rules={[{ required: true, message: '请输入排序' }]}
                tooltip="前台 ordering 页面展示的顺位，越小越靠前 (推荐 10, 20, 30...)"
              >
                <InputNumber min={0} max={999} style={{ width: '100%', borderRadius: 8 }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="allowed_categories"
            label={
              <Space>
                <span>{labels.formCategories}</span>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                  (选择此餐次允许选购的套餐类型)
                </Text>
              </Space>
            }
            tooltip="只有客户关联协议中包含这些分类的套餐，才能在该餐次下点餐。可多选或直接输入自定义分类。"
          >
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="请选择或输入套餐分类 (如: 饭盒, Buffet, 大型供餐)"
              options={availableCategories.map((c) => ({ label: c, value: c }))}
              tokenSeparators={[',', '，', ' ']}
              maxTagCount="responsive"
            />
          </Form.Item>

          {/* 快捷推荐分类标签库点选 */}
          <div style={{ marginTop: -8, marginBottom: 20 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>快捷选择推荐分类:</Text>
            <Space wrap size={[0, 4]}>
              {availableCategories.map((cat) => {
                const currentVals = (formCategoriesValue || []) as string[];
                const isSelected = currentVals.includes(cat);
                return (
                  <Tag.CheckableTag
                    key={cat}
                    checked={isSelected}
                    onChange={(checked) => {
                      const next = checked
                        ? [...currentVals, cat]
                        : currentVals.filter((v) => v !== cat);
                      form.setFieldsValue({ allowed_categories: next });
                    }}
                    style={{
                      borderRadius: 12,
                      padding: '1px 10px',
                      fontSize: 12,
                      border: isSelected ? '1px solid #3b82f6' : '1px solid #cbd5e1'
                    }}
                  >
                    + {cat}
                  </Tag.CheckableTag>
                );
              })}
            </Space>
          </div>

          {/* 实时下单效果预览卡片 */}
          <Card
            bordered={false}
            style={{
              background: '#f8fafc',
              borderRadius: 12,
              border: '1px dashed #cbd5e1',
              padding: 0
            }}
            bodyStyle={{ padding: 12 }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              👀 前台订餐页面效果预览：
            </Text>
            <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <span style={{ fontSize: 18 }}>{getShiftTheme(formNameValue || '').icon}</span>
                  <Text strong style={{ fontSize: 14 }}>{formNameValue || '餐次名称预览'}</Text>
                </Space>
                <Tag color="orange" style={{ borderRadius: 10 }}>#{form.getFieldValue('sort_order') || 10}</Tag>
              </Space>

              <div style={{ marginTop: 8 }}>
                {formCategoriesValue && formCategoriesValue.length > 0 ? (
                  <Space size={[4, 4]} wrap>
                    <Text type="secondary" style={{ fontSize: 11 }}>可选套餐:</Text>
                    {formCategoriesValue.map((c: string, idx: number) => (
                      <Tag key={idx} color="blue" style={{ fontSize: 11, borderRadius: 10 }}>{c}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    ⚠️ 未关联任何套餐分类，前台下单页将隐去该餐次选项。
                  </Text>
                )}
              </div>
            </div>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};
