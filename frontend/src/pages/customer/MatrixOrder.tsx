import React, { useEffect, useState } from 'react';
import { App, Card, InputNumber, Button, Select, DatePicker, Tag, Typography, Alert, Space, Row, Col, Divider, Modal, Input, Badge, Empty } from 'antd';
import { SendOutlined, ThunderboltOutlined, PlusOutlined, MinusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

export const MatrixOrder: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Kim Long Catering Ordering System' : '金龙伙食自助提报系统',
    subtitle: isEn ? 'Meals are dynamically displayed based on your agreement packages. To add new shifts, please contact administration.' : '依据后台给您分派的协议套餐动态显示餐品。若需新增餐次（如早餐、夜班），请联系中央厨房后台安排。',
    fastMode: isEn ? 'Fast Ordering Mode' : '快速订餐模式',
    quickFillYilian: isEn ? 'Quick Fill Yilian' : '一键易联标准',
    blockedTitle: isEn ? 'Ordering Restricted' : '订餐服务受限',
    blockedDesc: isEn ? 'Your account has been restricted from ordering due to outstanding payment. Please contact finance to verify invoice status.' : '您的账号目前存在未付账期款项，下单功能已被系统自动锁定，请联系财务核对对账单。',
    weekendReminderTitle: isEn ? 'Weekend Overtime Order Deadline Reminder' : '专享周末加班截止提醒',
    weekendReminderDesc: isEn ? 'Pro3C plant exclusive: Weekend order deadline extended to 18:00 PM. Please submit after headcount is finalized.' : 'pro3c 厂区专享：知道您周末员工排班统计较慢，您的截止订餐时间已延长至傍晚 18:00，请安心统计后提交。',
    sundayReminderTitle: isEn ? 'Sunday Routine Rest Notice' : '星期日例行休息提示',
    sundayReminderDesc: isEn ? 'Note: Based on your delivery schedule, Sunday is a rest day and no delivery is scheduled.' : '温馨提示：根据您的送餐习惯，星期日工厂安排例休无需送餐。',
    deliveryDate: isEn ? 'Select Delivery Date' : '选择送餐日期',
    deliverySite: isEn ? 'Select Delivery Site / Factory' : '选择送餐分点/工厂',
    selectSitePlaceholder: isEn ? 'Select Receiving Site' : '请选择接收工厂/厂区',
    orderPageTitle: isEn ? 'Order Page' : '下单页面',
    orderPageDesc: isEn ? 'Only showing shifts assigned to your profile by central kitchen.' : '系统仅显示后台已为您开通并配置了协议套餐的餐品类别。',
    emptyPackages: isEn ? 'No packages assigned by admin. Please contact customer service.' : '后台暂未为您分派任何协议餐食套餐，请联系系统管理员或客服安排。',
    selected: isEn ? 'Selected' : '已选',
    noOrder: isEn ? 'No Order' : '未订餐',
    orderedCount: isEn ? 'Ordered' : '已选订',
    portions: isEn ? 'portions' : '份',
    selectTemplate: isEn ? 'Select Package Template:' : '选择配餐套餐：',
    orderPax: isEn ? 'Order Pax / Portions' : '报餐人数/份数',
    extraRice: isEn ? 'Extra White Rice (Portions)' : '加白饭 (份数)',
    orderSummary: isEn ? 'Order Summary' : '已选订购小结',
    clearAll: isEn ? 'Clear Selections' : '清空选择',
    emptyCartTitle: isEn ? 'Your Cart is Empty' : '购物车空空如也',
    emptyCartDesc: isEn ? 'Please click meal cards to add order quantities.' : '请点击左侧菜品卡片设置人数报餐',
    defaultPkg: isEn ? 'Default Package' : '默认配餐',
    pax: isEn ? 'Pax' : '人',
    extraRiceShort: isEn ? 'Extra Rice' : '加白饭需求',
    remarkTitle: isEn ? 'Order Remarks (Preferences, etc.)' : '订单备注 (加饭/忌口等)',
    remarkPlaceholder: isEn ? 'e.g. Day shift 71, Night shift 40. Extra rice 5, no coriander...' : '例: 早班71份，夜班40份。加饭 5 份，不要香菜...',
    factory: isEn ? 'Delivery Site' : '配送工厂/分点',
    notSpecified: isEn ? 'Not Specified' : '未指定',
    totalPax: isEn ? 'Total Order Pax' : '总报餐人数',
    btnSubmit: isEn ? 'Confirm & Submit Order' : '确认无误，极速提交订单',
    btnLocked: isEn ? 'Account Locked, Ordering Restricted' : '账号锁定，限制下单',
    msgSuccess: isEn ? '🎉 Order submitted successfully!' : '🎉 订单提交成功！中央厨房已准备。',
    msgSelectAtLeastOne: isEn ? 'Please select at least one meal item.' : '请至少选择一份餐食并增加报餐人数',
    msgSelectSite: isEn ? 'Please select a delivery site.' : '请选择送餐工厂分点',
    msgLoadFailed: isEn ? 'Failed to load configuration.' : '加载订餐配置失败',
    msgLoadedEdit: isEn ? 'Order details successfully loaded for edit.' : '已成功载入您选择的订单数据以供修改。',
    msgQuickFillYilian: isEn ? 'Standard filled for Yilian: Breakfast 2, Lunch 2' : '已一键按【易联习惯】填充: 早餐2份 + 午餐2份',
    msgCleared: isEn ? 'Order quantities cleared.' : '报餐数量已清空',
    btnCancel: isEn ? 'Cancel' : '取消',
  };

  const translateMealSection = (name: string) => {
    if (!isEn) return name;
    const map: Record<string, string> = {
      '早餐': 'Breakfast',
      '早班午餐': 'Day Shift Lunch',
      '早班晚餐': 'Day Shift Dinner',
      '客户/顾问加餐饭盒': 'Visitor Bento',
      '夜班餐食 10pm Buffet': 'Night Shift 10pm Buffet',
      '夜班餐食 3am 宵夜': 'Night Shift 3am Supper'
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

  const [userInfo, setUserInfo] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  // 数据库定义的动态餐次列表
  const [dbMealSections, setDbMealSections] = useState<any[]>([]);

  // 矩阵输入数据 (份数数量)
  const [matrixData, setMatrixData] = useState<any>({});

  // 每个餐次独立选定的套餐 ID (存 customer_package.id)
  const [matrixPackages, setMatrixPackages] = useState<Record<string, number>>({});

  // 加白饭数量数据
  const [matrixAddons, setMatrixAddons] = useState<Record<string, number>>({});

  const [remark, setRemark] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * 获取某个餐次可用的套餐列表
   * 直接从后端为该餐次加载好（并包含默认价/协议价）的 packages 数组中返回
   */
  const getAvailablePackagesForSection = (sectionName: string) => {
    const section = dbMealSections.find(s => s.name === sectionName);
    return section ? (section.packages || []) : [];
  };

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      setUserInfo(u);
      fetchCustomerProfile(u.customer_id);
    }
  }, []);

  const fetchCustomerProfile = async (cid: number) => {
    try {
      // 1. 获取为该顾客开通的动态餐次和对应的公共套餐
      const resSections = await axiosInstance.get(`/orders/meal-sections?customer_id=${cid}`);
      const sectionsList = resSections.data || [];
      setDbMealSections(sectionsList);

      // 初始化矩阵状态的结构
      const initialData: Record<string, number> = {};
      const initialAddons: Record<string, number> = {};
      sectionsList.forEach((s: any) => {
        initialData[s.name] = 0;
        initialAddons[s.name] = 0;
      });

      // 根据后台拉取到的公用套餐，初始化各餐次的默认套餐配置
      const initialPkgs: Record<string, number> = {};
      sectionsList.forEach((s: any) => {
        if (s.packages && s.packages.length > 0) {
          initialPkgs[s.name] = s.packages[0].id;
        }
      });

      // 3. 检查是否有要编辑的订单载入
      const editingRaw = localStorage.getItem('editing_order');
      if (editingRaw) {
        const order = JSON.parse(editingRaw);
        setSelectedDate(order.delivery_date);
        setSelectedSiteId(order.site_id);

        const newQuantities = { ...initialData };
        const newAddons = { ...initialAddons };
        const newPackages = { ...initialPkgs };

        order.details.forEach((d: any) => {
          const name = d.meal_section_name || d.meal_section;
          if (newQuantities.hasOwnProperty(name)) {
            newQuantities[name] = d.quantity;
          }
          if (d.customer_package_id) {
            newPackages[name] = d.customer_package_id;
          }
          // 解析备注里的加白饭数量
          if (d.remark) {
            const match = d.remark.match(/加白饭\s*(\d+)\s*份/);
            if (match) {
              newAddons[name] = parseInt(match[1], 10);
            }
          }
        });

        setMatrixData(newQuantities);
        setMatrixAddons(newAddons);
        setMatrixPackages(newPackages);
        setRemark(order.remark || '');
        localStorage.removeItem('editing_order');
        message.info(labels.msgLoadedEdit);
      } else {
        setMatrixData(initialData);
        setMatrixAddons(initialAddons);
        setMatrixPackages(initialPkgs);
      }

      // NOTE: 使用客户专用接口获取自身资料和送货地址，避免不安全地加载所有客户列表
      const resCust = await axiosInstance.get(`/orders/customer-profile/${cid}`);
      if (resCust.data?.sites) {
        setSites(resCust.data.sites);
        if (!editingRaw && resCust.data.sites.length > 0) {
          setSelectedSiteId(resCust.data.sites[0].id);
        } else if (editingRaw) {
          const order = JSON.parse(editingRaw);
          setSelectedSiteId(order.site_id);
        }
      }
    } catch (err) {
      message.error(labels.msgLoadFailed);
    }
  };

  const isBlocked = userInfo?.is_blocked;
  const isPro3c = userInfo?.name?.toLowerCase().includes('pro3c') || userInfo?.username?.includes('pro3c');
  const isYilian = userInfo?.name?.includes('易联') || userInfo?.username?.includes('yilian');

  const isSunday = dayjs(selectedDate).day() === 0;
  const isWeekend = dayjs(selectedDate).day() === 0 || dayjs(selectedDate).day() === 6;

  // 易联软件 快捷一键 2+2
  const handleQuickFillYilian = () => {
    setMatrixData({
      ...matrixData,
      "早餐": 2,
      "早班午餐": 2
    });
    setRemark(isEn ? 'Yilian Standard: Breakfast Bento 2 + Lunch Bento 2' : '易联软件标准：早餐餐盒 2份 + 午餐餐盒 2份');
    message.success(labels.msgQuickFillYilian);
  };

  // 清空选择
  const handleClearOrder = () => {
    const cleared = { ...matrixData };
    Object.keys(cleared).forEach(key => cleared[key] = 0);
    setMatrixData(cleared);

    const clearedAddons = { ...matrixAddons };
    Object.keys(clearedAddons).forEach(key => clearedAddons[key] = 0);
    setMatrixAddons(clearedAddons);

    message.info(labels.msgCleared);
  };

  const handleSubmitOrder = async () => {
    if (isBlocked) {
      Modal.error({
        title: labels.btnLocked,
        content: labels.blockedDesc
      });
      return;
    }

    if (!selectedSiteId) {
      message.error(labels.msgSelectSite);
      return;
    }

    const items = Object.entries(matrixData)
      .filter(([sectionName, qty]) => {
        const sectionPkgs = getAvailablePackagesForSection(sectionName);
        return (qty as number) > 0 && sectionPkgs.length > 0;
      })
      .map(([sectionName, qty]) => {
        const sectionPkgs = getAvailablePackagesForSection(sectionName);
        const chosenPkgId = matrixPackages[sectionName] || (sectionPkgs.length > 0 ? sectionPkgs[0].id : null);
        
        // 自动将加白饭拼装写入备注
        const extraRiceQty = matrixAddons[sectionName] || 0;
        const itemRemark = [
          extraRiceQty > 0 ? `加白饭 ${extraRiceQty} 份` : '',
          remark ? remark : ''
        ].filter(Boolean).join(' | ');

        // 动态根据名称查找数据库餐次 ID
        const matchedSection = dbMealSections.find(s => s.name === sectionName);
        const actualSectionId = matchedSection ? matchedSection.id : 1;

        return {
          delivery_site_id: selectedSiteId!,
          meal_section_id: actualSectionId,
          customer_package_id: chosenPkgId,
          quantity: qty as number,
          remark: itemRemark
        };
      });

    if (items.length === 0) {
      message.error(labels.msgSelectAtLeastOne);
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post(`/orders/matrix-submit?customer_id=${userInfo.customer_id}`, {
        delivery_date: selectedDate,
        items: items
      });
      message.success(labels.msgSuccess);
      const resetData = { ...matrixData };
      Object.keys(resetData).forEach(key => resetData[key] = 0);
      setMatrixData(resetData);

      const resetAddons = { ...matrixAddons };
      Object.keys(resetAddons).forEach(key => resetAddons[key] = 0);
      setMatrixAddons(resetAddons);

      setRemark('');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPortions = Object.entries(matrixData).reduce((sum, [sectionName, qty]) => {
    const sectionPkgs = getAvailablePackagesForSection(sectionName);
    return sum + (sectionPkgs.length > 0 ? (qty as number) : 0);
  }, 0);

  const activeItemsCount = Object.entries(matrixData).filter(([sectionName, qty]) => {
    const sectionPkgs = getAvailablePackagesForSection(sectionName);
    return (qty as number) > 0 && sectionPkgs.length > 0;
  }).length;

  // 过滤得到在后台配置了套餐、允许显示在前端的餐次列表
  const visibleSections = Object.keys(matrixData).filter(sectionName => {
    const sectionPkgs = getAvailablePackagesForSection(sectionName);
    return sectionPkgs.length > 0;
  });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 顶部渐变 Banner 面板 */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
          borderRadius: 20, 
          padding: '24px 32px', 
          color: '#ffffff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Row align="middle" justify="space-between" gutter={[20, 20]}>
          <Col xs={24} md={14}>
            <Space orientation="vertical" size={2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={3} style={{ margin: 0, color: '#ffffff', fontWeight: 800, fontSize: 24 }}>{labels.title}</Title>
                <Tag color="success" style={{ borderRadius: 6, fontWeight: 'bold', border: 'none', background: '#10b981', color: '#fff' }}>{labels.fastMode}</Tag>
              </div>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>{labels.subtitle}</Text>
            </Space>
          </Col>
          
          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Space>
              {isYilian && !isSunday && (
                <Button type="primary" onClick={handleQuickFillYilian} style={{ background: '#38bdf8', borderColor: '#38bdf8', color: '#0f172a', borderRadius: 8, height: 40, fontWeight: 'bold' }}>
                  {labels.quickFillYilian}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* 警告拦截 Banner */}
      {isBlocked && (
        <Alert
          title={labels.blockedTitle}
          description={labels.blockedDesc}
          type="error"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {isPro3c && isWeekend && (
        <Alert
          title={labels.weekendReminderTitle}
          description={labels.weekendReminderDesc}
          type="info"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {isYilian && isSunday && (
        <Alert
          title={labels.sundayReminderTitle}
          description={labels.sundayReminderDesc}
          type="warning"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {/* 送餐信息选择栏 */}
      <div 
        style={{ 
          background: '#ffffff', 
          borderRadius: 16, 
          padding: '24px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9',
          marginBottom: 24
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              <Text strong style={{ fontSize: 14, color: '#334155' }}>{labels.deliveryDate}</Text>
              <DatePicker
                size="large"
                style={{ width: '100%', borderRadius: 10 }}
                value={dayjs(selectedDate)}
                onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
                allowClear={false}
              />
            </Space>
          </Col>
          
          <Col xs={24} sm={12}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              <Text strong style={{ fontSize: 14, color: '#334155' }}>{labels.deliverySite}</Text>
              <Select
                size="large"
                style={{ width: '100%', borderRadius: 10 }}
                value={selectedSiteId}
                onChange={(val) => setSelectedSiteId(val)}
                placeholder={labels.selectSitePlaceholder}
              >
                {sites.map((s) => (
                  <Option key={s.id} value={s.id}>{s.site_name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 主操作区域 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Text strong style={{ fontSize: 18, color: '#0f172a' }}>{labels.orderPageTitle}</Text>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{labels.orderPageDesc}</div>
            </div>
          </div>

          {visibleSections.length === 0 ? (
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 24px' }}>
              <Empty description={labels.emptyPackages} />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {visibleSections.map((sectionName) => {
                const qty = matrixData[sectionName];
                const addonQty = matrixAddons[sectionName] || 0;
                const isSelected = qty > 0;
                const sectionPkgs = getAvailablePackagesForSection(sectionName);
                const currentPkgId = matrixPackages[sectionName] || (sectionPkgs.length > 0 ? sectionPkgs[0].id : undefined);
                
                const matchedSecObj = dbMealSections.find(s => s.name === sectionName);
                const allowedCategories = matchedSecObj ? (matchedSecObj.allowed_categories || []) : [];
                const supportsExtraRice = allowedCategories.includes("饭盒") || allowedCategories.includes("大型供餐");

                return (
                  <Col xs={24} sm={12} key={sectionName}>
                    <Card
                      hoverable
                      style={{
                        borderRadius: 16,
                        border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                        boxShadow: isSelected ? '0 10px 20px rgba(16,185,129,0.06)' : '0 4px 6px rgba(0,0,0,0.01)',
                        background: isSelected ? '#f0fdf4' : '#ffffff',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      styles={{ body: { padding: 20 } }}
                      onClick={() => {
                        if (!isSelected && !isBlocked && !(isYilian && isSunday)) {
                          setMatrixData({ ...matrixData, [sectionName]: 1 });
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <Text strong style={{ fontSize: 16, color: '#0f172a', display: 'block' }}>{translateMealSection(sectionName)}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{qty > 0 ? `${labels.orderedCount} ${qty} ${labels.portions}` : labels.noOrder}</Text>
                        </div>
                        
                        {isSelected && (
                          <Badge status="success" text={<Text strong style={{ color: '#10b981', fontSize: 12 }}>{labels.selected}</Text>} />
                        )}
                      </div>

                      <div style={{ marginBottom: 16 }} onClick={(e) => e.stopPropagation()}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#64748b', fontWeight: 'bold' }}>
                          {labels.selectTemplate}
                        </Text>
                        <Select
                          size="middle"
                          style={{ width: '100%' }}
                          styles={{ popup: { root: { borderRadius: 10 } } }}
                          value={currentPkgId}
                          onChange={(val) => setMatrixPackages({ ...matrixPackages, [sectionName]: val })}
                          disabled={isBlocked || (isYilian && isSunday)}
                        >
                          {sectionPkgs.map((p) => (
                            <Option key={p.id} value={p.id}>{translatePackageTemplateName(p.name)}</Option>
                          ))}
                        </Select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#475569' }}>{labels.orderPax}</Text>
                          
                          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '3px 6px', borderRadius: 20 }}>
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              disabled={qty <= 0 || isBlocked || (isYilian && isSunday)}
                              icon={<MinusOutlined style={{ fontSize: 12, color: qty > 0 ? '#0f172a' : '#94a3b8' }} />}
                              onClick={() => setMatrixData({ ...matrixData, [sectionName]: Math.max(0, qty - 1) })}
                              style={{ width: 28, height: 28, background: qty > 0 ? '#ffffff' : 'transparent', boxShadow: qty > 0 ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                            />
                            
                            <InputNumber
                              min={0}
                              max={9999}
                              variant="borderless"
                              controls={false}
                              value={qty}
                              onChange={(val) => setMatrixData({ ...matrixData, [sectionName]: val || 0 })}
                              disabled={isBlocked || (isYilian && isSunday)}
                              style={{ width: 48, textAlign: 'center', fontWeight: 'bold', fontSize: 15, background: 'transparent' }}
                            />
                            
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              disabled={isBlocked || (isYilian && isSunday)}
                              icon={<PlusOutlined style={{ fontSize: 12, color: '#0f172a' }} />}
                              onClick={() => setMatrixData({ ...matrixData, [sectionName]: qty + 1 })}
                              style={{ width: 28, height: 28, background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                            />
                          </div>
                        </div>

                        {supportsExtraRice && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>
                            <Text style={{ fontSize: 13, color: '#475569' }}>{labels.extraRice}</Text>
                            
                            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '2px 4px', borderRadius: 20 }}>
                              <Button
                                type="text"
                                shape="circle"
                                size="small"
                                disabled={addonQty <= 0 || isBlocked || (isYilian && isSunday)}
                                icon={<MinusOutlined style={{ fontSize: 10, color: addonQty > 0 ? '#0f172a' : '#94a3b8' }} />}
                                onClick={() => setMatrixAddons({ ...matrixAddons, [sectionName]: Math.max(0, addonQty - 1) })}
                                style={{ width: 24, height: 24, background: addonQty > 0 ? '#ffffff' : 'transparent', boxShadow: addonQty > 0 ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                              />
                              
                              <InputNumber
                                min={0}
                                max={999}
                                variant="borderless"
                                controls={false}
                                value={addonQty}
                                onChange={(val) => setMatrixAddons({ ...matrixAddons, [sectionName]: val || 0 })}
                                disabled={isBlocked || (isYilian && isSunday)}
                                style={{ width: 36, textAlign: 'center', fontWeight: 'bold', fontSize: 13, background: 'transparent' }}
                              />
                              
                              <Button
                                type="text"
                                shape="circle"
                                size="small"
                                disabled={isBlocked || (isYilian && isSunday)}
                                icon={<PlusOutlined style={{ fontSize: 10, color: '#0f172a' }} />}
                                onClick={() => setMatrixAddons({ ...matrixAddons, [sectionName]: addonQty + 1 })}
                                style={{ width: 24, height: 24, background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Col>

        {/* 右侧：购物车 */}
        <Col xs={24} lg={8}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
              border: '1px solid #e2e8f0',
              padding: '24px',
              position: 'sticky',
              top: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{labels.orderSummary}</Text>
              </div>
              {activeItemsCount > 0 && (
                <Button type="link" danger size="small" onClick={handleClearOrder} style={{ padding: 0 }}>
                  {labels.clearAll}
                </Button>
              )}
            </div>

            <Divider style={{ margin: '0 0 20px 0' }} />

            {activeItemsCount === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', background: '#f8fafc', borderRadius: 16, marginBottom: 20, border: '1px dashed #cbd5e1' }}>
                <Text type="secondary" style={{ display: 'block', fontWeight: 'bold' }}>{labels.emptyCartTitle}</Text>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{labels.emptyCartDesc}</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {Object.entries(matrixData)
                  .filter(([sectionName, qty]) => {
                    const sectionPkgs = getAvailablePackagesForSection(sectionName);
                    return (qty as number) > 0 && sectionPkgs.length > 0;
                  })
                  .map(([sectionName, qty]) => {
                    const sectionPkgs = getAvailablePackagesForSection(sectionName);
                    const pkgId = matrixPackages[sectionName] || (sectionPkgs.length > 0 ? sectionPkgs[0].id : undefined);
                    const pkg = sectionPkgs.find((p: any) => p.id === pkgId);
                    const extraRiceQty = matrixAddons[sectionName] || 0;
                    
                    return (
                      <div 
                        key={sectionName} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: 6,
                          background: '#f8fafc', 
                          padding: '12px 14px', 
                          borderRadius: 12, 
                          border: '1px solid #f1f5f9' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <Text strong style={{ fontSize: 14, color: '#1e293b' }}>{translateMealSection(sectionName)}</Text>
                            </div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {pkg ? translatePackageTemplateName(pkg.template_name) : labels.defaultPkg}
                            </Text>
                          </div>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 'bold', minWidth: 60, textAlign: 'center' }}>
                            {qty as number} {labels.pax}
                          </span>
                        </div>

                        {extraRiceQty > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 8px' }}>
                            <Text style={{ fontSize: 12, color: '#b45309' }}>{labels.extraRiceShort}</Text>
                            <Text strong style={{ fontSize: 12, color: '#b45309' }}>+{extraRiceQty} {labels.portions}</Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: '#334155' }}>
                {labels.remarkTitle}
              </Text>
              <Input.TextArea
                rows={3}
                placeholder={labels.remarkPlaceholder}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                style={{ borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '16px', borderRadius: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{labels.factory}</Text>
                <Text strong style={{ color: '#0f172a', fontSize: 13 }} ellipsis={{ tooltip: true }}>
                  {sites.find(s => s.id === selectedSiteId)?.site_name || labels.notSpecified}
                </Text>
              </div>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{labels.deliveryDate}</Text>
                <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{selectedDate}</Text>
              </div>
              
              <Divider style={{ margin: '12px 0', borderStyle: 'dashed' }} />
              
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>{labels.totalPax}</Text>
                <Text strong style={{ fontSize: 24, color: '#10b981' }}>{totalPortions} {labels.pax}</Text>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              disabled={isBlocked || (isYilian && isSunday) || totalPortions === 0}
              onClick={handleSubmitOrder}
              style={{
                height: 52,
                fontSize: 16,
                fontWeight: 'bold',
                borderRadius: 12,
                background: isBlocked || totalPortions === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderColor: 'transparent'
              }}
            >
              {isBlocked ? labels.btnLocked : labels.btnSubmit}
            </Button>
          </div>
        </Col>
      </Row>
    </div>
  );
};
