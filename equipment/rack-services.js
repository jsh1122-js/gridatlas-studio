// Interface and source notes for generic service equipment. Model counts are illustrative.
const sources={
  row:['Vertiv · Liebert RX 列端配电柜','https://www.vertiv.com/en-us/products-catalog/critical-power/power-distribution/liebert-rx-distribution-cabinet/'],
  dc:['Vertiv · NetSure 直流供配电','https://www.vertiv.com/en-emea/products-catalog/critical-power/dc-power-systems/netsure-400v-dc-distributed-system/'],
  rPdu:['Schneider Electric · 零 U 机柜配电单元','https://shop.se.com/pro/us/en/product/apc-netshelter-metered-rack-pdu-zero-u-14-4kw-208v-24-c13-4-c19-2-nema-l6-30r-outlet/'],
  design:['Vertiv · 800 VDC 机房供电架构','https://www.vertiv.com/4aa1fb/globalassets/documents/white-papers/vertiv-800vdc-distribution-architectures-ai-data-center_white-paper_global-english_cs-10047.pdf'],
  hardware:['NVIDIA · DGX GB 硬件结构','https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html'],
  network:['NVIDIA · DGX GB 网络说明','https://docs.nvidia.com/dgx/dgxgb200-user-guide/networking.html'],
  server:['Lenovo · 服务器风扇与电源实例','https://lenovopress.lenovo.com/lp1910.pdf']
};
export const serviceNames={rowdist:'列头配电柜',pdu:'机柜侧配电',psu:'电源模块',fan:'风扇阵列',network:'网络布线'};
export const serviceModes={network:{cluster:'集群网络',management:'带外管理'}};
export function serviceExhibit(s,p){
  const dc=s.architecture!=='交流 UPS',nvl=s.profile!=='pcie',rail=dc?(s.architecture==='集中式 HVDC'?'项目直流电压':'800 VDC'):'交流';
  const guid=s.category==='rowdist'?(dc?sources.dc:sources.row):s.category==='pdu'?(dc?sources.dc:nvl?sources.hardware:sources.rPdu):s.category==='psu'?(dc?sources.design:nvl?sources.hardware:sources.server):s.category==='fan'?sources.server:sources.network;
  const base={source:guid[0],url:guid[1],pathTitle:'连接路径',origin:'功能剖面经过简化，端口数量和外观按演示模型绘制。实际接口、额定值与设备清单以项目选型为准。'};
  if(s.category==='rowdist')return {...base,title:dc?'直流列头配电柜':'交流列头配电柜',caption:'进线、分支保护与列内馈线',
    parts:{frame:['列头配电柜','位于供配电系统与机柜列之间，把一路上游电源分配到多条机柜支路。'],
      incoming:[dc?'直流进线':'交流进线',dc?'来自上游直流配电的馈线在进线端汇接，正、负极路由在柜内保持清晰。':'上游交流配电通过进线电缆接入柜体，图中进线端与多个末端出线端分层展示。'],
      mainBreaker:['进线保护','总进线保护覆盖柜内配电母线，选型需与 AC 或 DC 电压及系统保护要求相符。'],
      phaseBus:[dc?'直流正负母排':'分相母排',dc?'并行的正、负母排将直流送至分支保护装置。':'相导体沿母排把交流送往多个支路；中性线与保护导体按配电方案设置。'],
      branches:['分路保护','各支路通过独立保护器件。模型显示支路位置和输出方向，具体规格由项目短路与配合校核确定。'],
      meter:['支路计量','采集回路电压、电流等信息。仪表窗口代表计量功能，页面未接入柜内仪表。'],
      outgoing:['机柜馈线','分路保护后，馈线沿列内电力通道到达机柜配电单元或相应母线接口。']},
    facts:[['当前架构',p.config.architecture],['输入类型',dc?'直流':'交流'],['保护级别','进线与分路'],['下游','机柜列']],
    path:[dc?'直流进线':'交流进线','进线保护',dc?'正负母排':'分相母排','支路保护','列内馈线','机柜侧配电'],
    note:'列头柜集中分配多柜支路。机柜内继续完成分配与电源变换，可沿下方按钮追踪。',
    related:[['pdu','机柜侧配电'],[dc?(s.architecture==='集中式 HVDC'?'hvdc':s.architecture==='800V 直流'?'800v':'sst'):'ups','上游电源']]};
  if(s.category==='pdu'){
    const gbIn=nvl&&!dc;
    return {...base,title:dc?'机柜直流母排':gbIn?'NVL72 配电母排':'零 U 机柜配电单元',caption:dc?'直流馈入与取电接口':gbIn?'电源架输出与低压大电流母排':'垂直安装 · 交流输入与输出插座',
      parts:{frame:['安装结构','机柜侧面提供安装和约束结构，电源线束与数据跳线分区固定。'],
        inlet:[dc?'直流馈入':gbIn?'电源架输出':'交流进线',dc?'机柜接收设计电压相符的直流输入，极性与接口要求须核对。':gbIn?'DGX GB 参考柜的交流电源架先整流，再向柜内低压母排供电。':'列头柜支路通过输入电缆进入机柜 PDU。'],
        rail:[(dc||gbIn)?'成对直流母排':'内部配电导体',(dc||gbIn)?'两条导体为直流供回路径，绝缘支撑件保持间隔。':'内部导体把输入电源分配到纵向插座组；实际相位分配由型号确定。'],
        outlets:[(dc||gbIn)?'取电触点':'机柜插座',(dc||gbIn)?'设备通过相应直流取电触点接入。高压直流和 NVL72 柜内低压母排各有不同的接口。':'不同外形代表 C13 与 C19 等交流插座；数量与电流上限随产品变化。'],
        meter:[gbIn?'状态接口':'监测接口','用于表示配电状态或计量信号的采集位置。显示及通信能力取决于实际型号。'],
        lead:['负载端连接',(dc||gbIn)?'连接至兼容的托盘或机架侧变换单元，功率与连接器需匹配。':'输出线束把插座连接到服务器电源模块。']},
      facts:[['设施侧',rail],['安装位置',gbIn?'机柜后部':'机柜侧部'],['柜内载体',(dc||gbIn)?'直流母排':'交流 PDU'],['所选机柜',s.profile.toUpperCase()]],
      path:gbIn?['交流进线','电源架整流','约 50–51 V 柜内母排','计算托盘']:dc?['列端直流馈线','直流母排','取电触点','机架侧 DC/DC']:['交流支路','机柜 PDU','输出插座','服务器 PSU'],
      note:dc?'当前选择直流设施方案。GB200/GB300 原厂机柜输入与所选直接直流路径的兼容性须另行验证。':'PDU 负责分配电能。电压变换由供电模块承担。',
      related:[['rowdist','列头配电柜'],['psu','电源模块'],['rack','返回样机']]};
  }
  if(s.category==='psu')return {...base,title:dc?'机架侧 DC/DC 模块':nvl?'NVL72 电源架与 PSU':'服务器交流 PSU',caption:'可抽模块 · 功率级、散热与连接器',
    parts:{frame:['导轨与插槽','导轨限定模块的插拔方向，机箱向模块提供机械支撑。'],
      module:['可抽电源模块','带拉手的模块沿导轨插入；拆解视图把模块和内部部件分开展示。冗余与热插拔能力由选型确定。'],
      connector:[dc?'直流输入接口':'交流输入接口',dc?'接口接收上游直流电源，连接器的电压、电流、极性必须与目标直流系统相符。':'模块接收交流馈电，输入连接器与低压输出触点分开。'],
      converter:[dc?'隔离 DC/DC 功率级':'整流与稳压功率级',dc?'直流输入经开关变换、隔离与输出稳压，形成硬件所需的内部电压。':'交流输入经整流和后续变换形成可供负载使用的直流电压。图中区分磁性器件、储能元件和功率器件。'],
      cooling:['散热器与风道','功率器件产生的热量传到翅片，由经过模块的气流带出。'],
      backplane:[nvl&&!dc?'电源架输出母排':'输出背板触点',nvl&&!dc?'电源架将约 50–51 V DC 分配给原厂计算托盘和交换部分。':'模块低压输出通过背部触点与背板接合，由后级电源向计算板供电。']},
    facts:[['上游输入',rail],['转换',dc?'DC → DC':'AC → DC'],['工作形态','可抽模块'],['接口规格','按型号选用']],
    path:[dc?'直流馈电':'交流馈电','输入连接器',dc?'DC/DC 变换':'整流与稳压','输出触点',nvl&&!dc?'低压母排':'负载背板'],
    note:dc?'当前路径要求有对应直流输入设计的变换器。SST 或 800VDC 设施方案与现有交流 PSU 的接口须逐项校核。':'GB 参考柜使用电源架；通用 PCIe 服务器可采用机箱侧的可抽 PSU。机型间的外形、输入和容量各异。',
    related:[['pdu','机柜配电'],['fan','风扇模块'],['rack','算力机柜']]};
  if(s.category==='fan')return {...base,title:'可抽式风扇阵列',caption:'风扇盒、叶轮、驱动与风道',
    parts:{frame:['阵列风道','框架把风扇模块编成阵列，并限制空气从风扇旁侧短路回流。'],cartridge:['可抽风扇盒','带拉手的风扇盒将风扇与机箱机械连接。模型拆解展示抽出方向。'],
      impeller:['叶轮','弯曲叶片绕轴旋转，推动空气沿机箱风道流动。'],motor:['无刷电机','轮毂内的电机驱动叶轮，转速与控制信号由设备管理系统处理。'],
      guard:['防护网罩','圆环与支撑筋位于风扇外侧，保护叶轮和相邻线束。'],airflow:['空气流向','流线从进风端穿过叶轮指向排风端。它表示方向，风量和转速均未计量。'],
      connector:['供电与反馈端','模块连接器向电机供电，并可带控制或转速反馈信号。']},
    facts:[['介质','空气'],['转动件','轴向叶轮'],['模块','风扇盒'],['反馈','按型号配置']],
    path:['进风端','防护网罩','叶轮 / 电机','设备风道','排风端'],note:nvl?'此视图解释空气侧散热。NVL72 的主要 CPU/GPU 使用冷板，电源、网络或其他组件仍有空气侧散热。':'通用 PCIe 服务器可使用阵列风扇向板卡与散热器送风。示意模块数和位置独立于方案设备清单。',
    related:[['air','机房冷热通道'],['psu','电源模块']]};
  const mg=s.operating==='management';
  return {...base,title:mg?'机柜管理网络':nvl?'集群网络布线':'机架顶端交换与布线',caption:mg?'带外管理 · 铜缆':'收发模块 · 双端跳线与网卡',
    parts:{frame:['网络机架','以交换机和一台服务器为端点，中间展示数据线缆的受控走向。'],tor:[mg?'管理 ToR 交换机':nvl?'集群接入交换机':'ToR 交换机',mg?'管理交换机汇聚托盘或服务器管理接口。':'通用服务器可接机架顶部交换机；GB 的集群网卡可连接外部网络交换机，柜内 NVLink 交换托盘承担另一类通信。'],
      optic:[mg?'管理口接头':'可插收发模块',mg?'本例管理链路采用电口，RJ45 连接器插入以太网端口。':'交换机端和网卡端各有相容的收发模块，电信号和光信号在端口处转换。'],
      patch:[mg?'管理网跳线':'光纤跳线',mg?'管理网线把交换机电口与设备 BMC 管理口连接。':'图中一束双端光纤跳线连接两端模块。具体规格、速率及单双纤方案由选型确定。'],
      nic:[mg?'BMC 管理口':'服务器网口',mg?'管理口连接板载管理控制器，传输管理与状态信息。':'网络接口与主机总线相连，承担跨服务器或跨柜通信。'],
      manager:['理线器','线缆通过理线环或竖向通道，预留弯曲半径与余量，并与电力线、冷却管路分开。']},
    facts:[['链路',mg?'带外管理':'集群数据'],['介质',mg?'铜缆':'光纤示例'],['服务器端',mg?'BMC':s.profile==='gb300'?'ConnectX-8':s.profile==='gb200'?'ConnectX-7':'所选网卡'],['路径','逻辑示意']],
    path:mg?['管理 ToR','RJ45 管理跳线','理线器','BMC 管理口']:['交换机端口','收发模块','光纤跳线','收发模块','服务器网口'],
    note:'本视图的彩色线束仅表示通信。供电线缆连接 PDU 或电源模块；液冷管路连接歧管与冷板。',related:[['rack','算力机柜']]};
}
