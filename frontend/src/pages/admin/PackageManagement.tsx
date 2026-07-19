import React, { useEffect, useRef, useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, message,
  Tag, Typography, Space, Popconfirm, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, AppstoreOutlined, PlusSquareOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;

export const PackageManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  // NOTE: 文案集中管理，便于维护
  const labels = {
    pageTitle: isEn ? '🍱 Central Kitchen Base Packages Database' : '🍱 中央厨房基础套餐模板库 (全局主档)',
    addonSectionTitle: isEn ? '🥚 Add-on Pool (Single Items)' : '🥚 Add-on 单点池（全局主档）',
    addonSectionDesc: isEn
      ? 'Manage individual add-ons (e.g. Egg, White Rice, Fruit) that can be assigned to any customer menu.'
      : '管理可单独点购的项目（如鸡蛋、白饭、水果等），可在客户菜单库中分配给指定客户。',

    // 套餐区
    colPkgName: isEn ? 'Package Name' : '套餐名称',
    colCategory: isEn ? 'Category' : '分类',
    colDefaultPrice: isEn ? 'Default Base Price' : '默认基础价',
    colDescription: isEn ? 'Description' : '配料描述',
    colAction: isEn ? 'Actions' : '操作',
    btnCreatePkg: isEn ? '+ Create Package' : '+ 创建新套餐',
    modalCreateTitle: isEn ? 'Create New Package Template' : '创建新基础套餐模板',
    modalEditTitle: isEn ? 'Edit Package Template' : '修改基础套餐模板',
    formPkgName: isEn ? 'Package Name' : '套餐名称',
    placeholderPkgName: isEn
      ? 'e.g. Bento Box / Japanese Bento Box'
      : '例如: 日式饭盒 / 饭盒 (2菜1肉1水果)',
    formCategory: isEn ? 'Category' : '分类',
    formDefaultPrice: isEn ? 'Default Unit Price (RM)' : '基础默认单价 (RM)',
    formDescription: isEn ? 'Ingredients & Description' : '菜品成分/配料描述',
    placeholderDescription: isEn
      ? 'e.g. Teriyaki chicken, rice, side dishes'
      : '如：包含照烧鸡排/三文鱼、米饭、日式小菜',
    catBento: isEn ? 'Bento Box' : '饭盒',
    catBulk: isEn ? 'Bulk Meals' : '大型供餐',
    catBuffet: isEn ? 'Buffet Meal' : 'Buffet 自助餐',

    // Add-on 区
    colAddonName: isEn ? 'Add-on Name' : '单点项目名称',
    colAddonDefaultPrice: isEn ? 'Default Price (RM)' : '默认单价 (RM)',
    colAddonDescription: isEn ? 'Description' : '描述',
    btnCreateAddon: isEn ? '+ Create Add-on' : '+ 创建新 Add-on',
    modalCreateAddonTitle: isEn ? 'Create New Add-on' : '创建新 Add-on 单点项',
    modalEditAddonTitle: isEn ? 'Edit Add-on' : '修改 Add-on 单点项',
    formAddonName: isEn ? 'Add-on Name' : 'Add-on 名称',
    placeholderAddonName: isEn ? 'e.g. Egg / White Rice / Fruit' : '例如：鸡蛋 / 白饭 / 水果',
    formAddonDefaultPrice: isEn ? 'Default Unit Price (RM)' : '基础默认单价 (RM)',
    formAddonDescription: isEn ? 'Description (optional)' : '描述（选填）',
    placeholderAddonDesc: isEn ? 'e.g. Hard boiled egg, 1 piece' : '如：熟鸡蛋 1 粒',
    confirmDeleteAddon: isEn
      ? 'Delete this Add-on template?'
      : '确定要删除此 Add-on 模板吗？',
    addonCreateSuccess: isEn ? 'Add-on created!' : 'Add-on 创建成功！',
    addonCreateFailed: isEn ? 'Failed to create Add-on' : '创建 Add-on 失败',
    addonUpdateSuccess: isEn ? 'Add-on updated!' : 'Add-on 修改成功！',
    addonUpdateFailed: isEn ? 'Failed to update Add-on' : '修改 Add-on 失败',
    addonDeleteSuccess: isEn ? 'Add-on deleted!' : 'Add-on 已删除！',
    addonDeleteFailed: isEn ? 'Failed to delete Add-on' : '删除 Add-on 失败',
    loadAddonsFailed: isEn ? 'Failed to fetch Add-ons' : '获取 Add-on 列表失败',

    // 共用
    btnSave: isEn ? 'Save' : '确定',
    btnCancel: isEn ? 'Cancel' : '取消',
    btnEdit: isEn ? 'Edit' : '修改',
    btnDelete: isEn ? 'Delete' : '删除',
    createSuccess: isEn ? 'Package template created successfully' : '套餐模板创建成功',
    createFailed: isEn ? 'Failed to create package template' : '创建套餐失败',
    updateSuccess: isEn ? 'Package template updated successfully' : '套餐模板修改成功',
    updateFailed: isEn ? 'Failed to update package template' : '修改套餐失败',
    deleteSuccess: isEn ? 'Package template deleted successfully!' : '已成功删除套餐模板！',
    deleteFailed: isEn ? 'Failed to delete package template' : '删除套餐失败',
    confirmDeleteTemplate: isEn
      ? 'Are you sure you want to delete this base package template?'
      : '确定要删除此基础套餐模板吗？',
    loadPkgsFailed: isEn ? 'Failed to fetch package templates' : '获取套餐列表失败',
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

  // ── 分类管理 State ──
  // NOTE: 默认内置分类 + 用户自定义分类合并，存储到 localStorage 持久化
  const DEFAULT_CATEGORIES = ['饭盒', '大型供餐', 'Buffet', '宵夜'];
  const STORAGE_KEY = 'ck_pkg_categories';

  const loadCategories = (): string[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        // 合并默认分类，去重
        return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
      }
    } catch {
      // ignore
    }
    return [...DEFAULT_CATEGORIES];
  };

  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const newCategoryInputRef = useRef<any>(null);

  /**
   * 从已有套餐数据中提取分类，合并到列表（防止历史数据丢失）
   */
  const syncCategoriesFromPackages = (pkgs: any[]) => {
    const existing = pkgs.map((p) => p.category).filter(Boolean);
    setCategories((prev) => {
      const merged = Array.from(new Set([...prev, ...existing]));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  /**
   * 添加新自定义分类
   */
  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      if (prev.includes(trimmed)) {
        message.warning(isEn ? 'Category already exists' : '该分类已存在');
        return prev;
      }
      const next = [...prev, trimmed];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setNewCategoryInput('');
    // NOTE: 添加后让输入框失焦，防止下拉关闭时 focus 卡死
    setTimeout(() => newCategoryInputRef.current?.blur(), 100);
  };

  // ── 套餐 State ──
  const [packages, setPackages] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any | null>(null);
  const [form] = Form.useForm();

  // ── Add-on State ──
  const [addons, setAddons] = useState<any[]>([]);
  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any | null>(null);
  const [addonForm] = Form.useForm();

  // ── 套餐 逻辑 ──
  const fetchPackages = async () => {
    try {
      const res = await axiosInstance.get('/admin/packages');
      setPackages(res.data || []);
      // NOTE: 从后端返回的数据中同步历史分类，防止分类丢失
      syncCategoriesFromPackages(res.data || []);
    } catch {
      message.error(labels.loadPkgsFailed);
    }
  };

  // ── Add-on 逻辑 ──
  const fetchAddons = async () => {
    try {
      const res = await axiosInstance.get('/admin/addons');
      setAddons(res.data || []);
    } catch {
      message.error(labels.loadAddonsFailed);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchAddons();
  }, []);

  const handleSavePackage = async (values: any) => {
    try {
      if (editingPkg) {
        await axiosInstance.put(`/admin/packages/${editingPkg.id}`, values);
        message.success(labels.updateSuccess);
      } else {
        await axiosInstance.post('/admin/packages', values);
        message.success(labels.createSuccess);
      }
      setModalVisible(false);
      setEditingPkg(null);
      form.resetFields();
      fetchPackages();
    } catch {
      message.error(editingPkg ? labels.updateFailed : labels.createFailed);
    }
  };

  const handleOpenEditPackage = (record: any) => {
    setEditingPkg(record);
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      default_price: record.default_price,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleOpenCreatePackage = () => {
    setEditingPkg(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleDeletePackageTemplate = async (record: any) => {
    try {
      await axiosInstance.delete(`/admin/packages/${record.id}`);
      message.success(labels.deleteSuccess);
      fetchPackages();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || labels.deleteFailed;
      message.error(errMsg);
    }
  };

  /**
   * 保存 Add-on（创建或修改）
   */
  const handleSaveAddon = async (values: any) => {
    try {
      if (editingAddon) {
        await axiosInstance.put(`/admin/addons/${editingAddon.id}`, values);
        message.success(labels.addonUpdateSuccess);
      } else {
        await axiosInstance.post('/admin/addons', values);
        message.success(labels.addonCreateSuccess);
      }
      setAddonModalVisible(false);
      setEditingAddon(null);
      addonForm.resetFields();
      fetchAddons();
    } catch {
      message.error(editingAddon ? labels.addonUpdateFailed : labels.addonCreateFailed);
    }
  };

  const handleOpenEditAddon = (record: any) => {
    setEditingAddon(record);
    addonForm.setFieldsValue({
      name: record.name,
      default_price: record.default_price,
      description: record.description,
    });
    setAddonModalVisible(true);
  };

  const handleOpenCreateAddon = () => {
    setEditingAddon(null);
    addonForm.resetFields();
    setAddonModalVisible(true);
  };

  const handleDeleteAddon = async (record: any) => {
    try {
      await axiosInstance.delete(`/admin/addons/${record.id}`);
      message.success(labels.addonDeleteSuccess);
      fetchAddons();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || labels.addonDeleteFailed;
      message.error(errMsg);
    }
  };

  // ── 套餐表格列 ──
  const packageColumns = [
    {
      title: labels.colPkgName,
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Text strong style={{ fontSize: 14 }}>
          {translatePkgName(text)}
        </Text>
      ),
    },
    {
      title: labels.colCategory,
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (val: string) => <Tag color="green">{translateCategory(val)}</Tag>,
    },
    {
      title: labels.colDefaultPrice,
      dataIndex: 'default_price',
      key: 'default_price',
      width: 150,
      render: (val: number) => <Text strong>RM {val.toFixed(2)}</Text>,
    },
    {
      title: labels.colDescription,
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 140,
      render: (record: any) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditPackage(record)}
          >
            {labels.btnEdit}
          </Button>
          <Popconfirm
            title={labels.confirmDeleteTemplate}
            onConfirm={() => handleDeletePackageTemplate(record)}
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

  // ── Add-on 表格列 ──
  const addonColumns = [
    {
      title: labels.colAddonName,
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
          {text}
        </Text>
      ),
    },
    {
      title: labels.colAddonDefaultPrice,
      dataIndex: 'default_price',
      key: 'default_price',
      width: 160,
      render: (val: number) => (
        <Tag color="orange" style={{ fontWeight: 'bold', fontSize: 13 }}>
          RM {val.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: labels.colAddonDescription,
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {val || '—'}
        </Text>
      ),
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 140,
      render: (record: any) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditAddon(record)}
          >
            {labels.btnEdit}
          </Button>
          <Popconfirm
            title={labels.confirmDeleteAddon}
            onConfirm={() => handleDeleteAddon(record)}
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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── 页面标题 ── */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppstoreOutlined style={{ fontSize: 26, color: '#16a34a' }} />
        <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
          {labels.pageTitle}
        </Title>
      </div>

      {/* ── 套餐模板区块 ── */}
      <Card
        style={{ borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', marginBottom: 32 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreatePackage}>
            {labels.btnCreatePkg}
          </Button>
        }
      >
        <Table
          columns={packageColumns}
          dataSource={packages}
          rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          style={{ width: '100%' }}
        />
      </Card>

      {/* ── Add-on 单点池区块 ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <PlusSquareOutlined style={{ fontSize: 22, color: '#ea580c' }} />
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>
            {labels.addonSectionTitle}
          </Title>
        </div>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {labels.addonSectionDesc}
        </Text>
      </div>

      <Card
        style={{ borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateAddon}
            style={{ background: '#ea580c', borderColor: '#ea580c' }}
          >
            {labels.btnCreateAddon}
          </Button>
        }
      >
        <Table
          columns={addonColumns}
          dataSource={addons}
          rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          style={{ width: '100%' }}
          locale={{
            emptyText: isEn
              ? 'No Add-ons yet. Click "+ Create Add-on" to get started.'
              : '暂无 Add-on，点击「+ 创建新 Add-on」开始添加。',
          }}
        />
      </Card>

      {/* ── 套餐 Modal ── */}
      <Modal
        title={editingPkg ? labels.modalEditTitle : labels.modalCreateTitle}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingPkg(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSavePackage}>
          <Form.Item name="name" label={labels.formPkgName} rules={[{ required: true }]}>
            <Input placeholder={labels.placeholderPkgName} size="large" />
          </Form.Item>
          <Form.Item name="category" label={labels.formCategory} initialValue="饭盒">
            {/* NOTE: 支持从已有分类选择，也可在底部输入框输入新分类后点「添加」创建 */}
            <Select
              size="large"
              showSearch
              optionFilterProp="children"
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '6px 0' }} />
                  <div style={{ display: 'flex', gap: 8, padding: '4px 8px 8px' }}>
                    <Input
                      ref={newCategoryInputRef}
                      size="small"
                      placeholder={isEn ? 'New category name...' : '输入新分类名称...'}
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        // NOTE: 阻止 Enter 冒泡关闭下拉，只触发添加
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          handleAddCategory();
                        }
                      }}
                    />
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddCategory}
                      style={{ background: '#16a34a', borderColor: '#16a34a', flexShrink: 0 }}
                    >
                      {isEn ? 'Add' : '添加'}
                    </Button>
                  </div>
                </>
              )}
            >
              {categories.map((cat) => (
                <Option key={cat} value={cat}>
                  {translateCategory(cat)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="default_price" label={labels.formDefaultPrice} initialValue={15.0}>
            <InputNumber style={{ width: '100%' }} precision={2} size="large" prefix="RM" />
          </Form.Item>
          <Form.Item name="description" label={labels.formDescription}>
            <Input.TextArea rows={3} placeholder={labels.placeholderDescription} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Add-on Modal ── */}
      <Modal
        title={editingAddon ? labels.modalEditAddonTitle : labels.modalCreateAddonTitle}
        open={addonModalVisible}
        onCancel={() => { setAddonModalVisible(false); setEditingAddon(null); addonForm.resetFields(); }}
        onOk={() => addonForm.submit()}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={520}
      >
        <Form form={addonForm} layout="vertical" onFinish={handleSaveAddon}>
          <Form.Item name="name" label={labels.formAddonName} rules={[{ required: true }]}>
            <Input placeholder={labels.placeholderAddonName} size="large" />
          </Form.Item>
          <Form.Item name="default_price" label={labels.formAddonDefaultPrice} initialValue={1.5}>
            <InputNumber style={{ width: '100%' }} precision={2} size="large" prefix="RM" min={0} />
          </Form.Item>
          <Form.Item name="description" label={labels.formAddonDescription}>
            <Input.TextArea rows={2} placeholder={labels.placeholderAddonDesc} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
