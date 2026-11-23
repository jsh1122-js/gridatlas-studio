const papers={
  transformer:['Eaton · 变压器工作原理','https://www.eaton.com/us/en-us/products/low-voltage-power-distribution-control-systems/transformers/transformer-fundamentals-.html'],
  switchgear:['Schneider Electric · 中压开关设备','https://www.se.com/ww/en/work/products/medium-voltage-switchgear-and-energy-automation/'],
  sst:['Infineon · SST 功率变换与隔离','https://www.infineon.com/product-information/solid-state-transformer-designers-guide-to-system-voltage-topology-submodule-power-with-sic'],
  architecture:['Vertiv · 800 VDC 架构，第 6–7 页','https://www.vertiv.com/4aa1fb/globalassets/documents/white-papers/vertiv-800vdc-distribution-architectures-ai-data-center_white-paper_global-english_cs-10047.pdf'],
  nvidia:['NVIDIA · 800 VDC 供电架构','https://www.nvidia.com/en-us/data-center/technologies/800-vdc-architecture/'],
  hvdc:['Vertiv · NetSure 400 VDC 系统','https://www.vertiv.com/en-emea/products-catalog/critical-power/dc-power-systems/netsure-400v-dc-distributed-system/']
};
export const powerSettings={
  transformer:{loaded:'带载示意',idle:'二次侧空载'},
  switchgear:{closed:'馈线连通',open:'馈线断开'},
  sst:{solid:'SST 变换',conventional:'工频变压＋整流'},
  hvdc:{rectified:'整流供电',stored:'电池供电'}
};
export const powerCategoryNames={transformer:'配电变压器',switchgear:'中压开关柜',sst:'800V 直流',hvdc:'集中式 HVDC'};
export function powerDestination(architecture){
  if(architecture==='集中式 HVDC')return 'hvdc';
  if(architecture==='800V 直流')return '800v';
  if(architecture==='SST 800V 直流')return 'sst';
  return 'ups';
}
const parts={
  transformer:{
    frame:['干式配电变压器','三相干式隔离变压器通过铁芯中的交变磁通，将一次绕组的交流电能传递给二次绕组。'],
    highSide:['高压侧端子','连接本级变压器的较高电压绕组，本示例为园区中压配电的下游。'],
    windPrimary:['一次绕组','接交流电源后产生交变磁通。模型把外层绕组向侧面拉开，以便与二次绕组区分。'],
    core:['叠片铁芯','上下铁轭和三根铁芯柱构成磁通回路。磁通耦合两组绕组，导线未直接相连。'],
    windSecondary:['二次绕组','交变磁通在二次侧感应电压。理想变压条件下，电压比等于两侧匝数比。'],
    lowSide:['低压侧母排','低压侧端子向下游交流配电送电，进而接 UPS、集中整流器或其他交流负荷。']
  },
  switchgear:{
    frame:['中压气体绝缘开关柜','本例为园区配电用气体绝缘开关设备（Gas-Insulated Switchgear，GIS）。此处 GIS 指电气设备；场址地图中的 GIS 指地理信息系统。'],
    incoming:['进线接口','中压交流电通过电缆终端进入成套设备，由金属封闭柜内的母线进行分配。'],
    busbar:['中压母线','同一段母线连接进线与馈线间隔，所能承受的电流与短路等级来自实际铭牌。'],
    gasTank:['气体绝缘隔室','接地金属气室提供绝缘环境。不同设备采用不同气体；例如部分型号采用干燥空气绝缘和真空灭弧。'],
    breaker:['馈线断路器','接通状态对应馈线具备导通路径。断开状态仅表示本馈线的断路器断开；上游母线仍可能带电。'],
    cable:['出线电缆','馈线电缆将电能送到下游配电变压器或变换装置。按钮仅改变模型中的连接状态。']
  },
  sst:{
    frame:['800 VDC 供电架构','园区侧完成交流到 800 VDC 的变换，直流配电送至机架侧变换器。切换架构可比较两种功能分段。'],
    incoming:['园区交流输入','展示中压交流进入设施侧变换系统的接口。接入电压、短路容量及配套开关根据项目审核确定。'],
    frontEnd:['功率变换单元','多级 SST 的输入级以功率电子器件完成受控整流，中间直流电压由后级变换与隔离。'],
    isolation:['隔离变换','本例选用带中高频变压器的隔离型 DC/DC 级，实现电压变换与电气隔离。器件和级数需按选定拓扑确定。'],
    dcBus:['800 V 直流母线','将变换后的直流电送向数据厅。极性、接地、直流保护和故障选择性均需协调设计。'],
    rackDc:['机架侧 DC/DC','兼容 800 VDC 的机架将母线电压变换至内部供电轨，再由板级调压电路供给芯片。']
  },
  hvdc:{
    frame:['集中整流直流电源','设施侧并联整流模块将交流转换为直流，多路直流馈线面向具备相应输入范围的负载。'],
    incoming:['交流输入','本例展示经上游变压器和配电保护送入整流柜的低压交流。'],
    frontEnd:['并联整流模块','多个 AC/DC 模块共同承担负荷。实际均流、冗余和热备容量取决于系统配置。'],
    storage:['电池支路','电池通过相应保护及接入装置支撑直流母线。本工况假设电池可用，实际电压窗口、后备时间由配置决定。'],
    dcBus:['直流母线','原厂参考产品标称 400 VDC，实际运行电压随整流与储能设置变化。本例的数值仅说明这一类系统。'],
    feeder:['直流馈线','各支路经直流保护后接入适配负载。终端接受电压、过流保护和隔离方式需逐项匹配。']
  }
};
export function powerExhibit(state,project){
  const c=state.category,mode=state.operating,arch=project.config.architecture;
  const dest=powerDestination(arch),selected=powerSettings[c][mode],definition=parts[c];
  const base={parts:definition,source:papers[c][0],url:papers[c][1],pathTitle:'当前电能路径'};
  if(c==='transformer'){
    const loaded=mode==='loaded';
    return {...base,title:'三相干式配电变压器',caption:selected+' · 电磁耦合示意',facts:[['结构','双绕组 / 三相'],['一次侧','交流中压'],['二次侧',loaded?'接入负荷':'空载有感应电压'],['变比 / 容量','依项目铭牌']],
      path:loaded?['高压端子','一次绕组','铁芯磁耦合','二次绕组','低压负荷']:['高压端子','一次绕组励磁','铁芯磁耦合','二次感应电压'],
      note:'一次与二次的电能通过磁场耦合。空载时仍有励磁电流和铁芯损耗，二次端仍有电压。',
      origin:'三相配电变压器功能剖面。图中绕组比例、匝数和端子位置经过简化；电压变比、容量、接线组别和实际数量尚待项目资料。',
      related:[['switchgear','上游中压开关柜'],[dest,'方案负荷侧供电']]};
  }
  if(c==='switchgear'){
    const closed=mode==='closed';
    return {...base,title:'中压气体绝缘开关柜',caption:selected+' · 断路器状态示意',facts:[['绝缘介质','按柜型确定'],['开断部件','断路器'],['所选馈线',closed?'导通':'开路'],['设备简称','电气 GIS']],
      path:closed?['进线','中压母线','馈线断路器','电缆终端','下游设备']:['进线','中压母线','馈线断路器断口'],
      note:'断路器承担接通和开断功能，气体承担绝缘功能。当前画面展示逻辑连通状态，设备隔离状态由实际一次系统确定。',
      origin:'中压成套开关的功能剖面，额定电压、气体种类、保护配置及现场接线均以选定设备为准。',related:[['transformer','下游配电变压器']]};
  }
  if(c==='sst'){
    const solid=mode==='solid';
    const partMap=solid?definition:{...definition,frontEnd:['工频变压器','先以工频变压器降低交流电压并提供隔离，再送入集中整流设备。'],isolation:['集中整流单元','接收工频变压器输出的低压交流，转换为本架构所需的 800 V 直流。']};
    return {...base,parts:partMap,title:solid?'SST · 800 VDC':'工频变压整流 · 800 VDC',caption:selected+' · 架构参考',facts:[['交流输入','园区中压'],['隔离环节',solid?'中高频隔离变换':'工频变压器'],['母线标称','800 VDC'],['方案供电',arch]],
      path:solid?['中压交流','有源整流','隔离型 DC/DC','800 VDC 母线','机架侧变换']:['中压交流','工频变压器','集中整流','800 VDC 母线','机架侧变换'],
      note:'两条路线均需匹配直流母线保护、储能接口和机架输入。当前展示的 GB200 / GB300 样机与 800 VDC 配电之间须另行验证电源接口。',
      origin:'参考设计比较设施侧两种 800 VDC 供电路线。本站模型不代表项目采购、现场投运或现有机柜可直接接用。',
      url:solid?papers.sst[1]:papers.architecture[1],source:solid?papers.sst[0]:papers.architecture[0],
      extraSources:solid?[papers.architecture,papers.nvidia]:[papers.nvidia],related:[['switchgear','上游中压开关柜'],['rack','参考算力机柜']]};
  }
  const stored=mode==='stored';
  return {...base,title:'集中式 HVDC 整流配电',caption:selected+' · 400 VDC 参考系统',facts:[['架构','集中整流'],['参考母线','标称 400 VDC'],['当前输入',stored?'电池支路':'低压交流'],['方案供电',arch]],
    path:stored?['电池组','电池支路保护','直流母线','直流馈线','兼容负载']:['低压交流','并联整流模块','直流母线','直流馈线','兼容负载'],
    note:'直流输出经受保护的馈线送到兼容设备。参考值取自 NetSure 产品；其他直流系统可采用不同的标称和运行电压。',
    origin:'参考 Vertiv NetSure 400V 系列的功能组成。园区中的电池方案、整流容量、负载输入及保护配合尚待设备选型。',related:[['transformer','上游配电变压器'],['rack','参考算力机柜']]};
}
