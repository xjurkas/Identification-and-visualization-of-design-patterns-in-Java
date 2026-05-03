Singleton — Pokus 2: Private constructor
Datum: 2026-04-29 15:33:50
Pravidlo: static self-typed field + static no-param accessor + PRIVATE CONSTRUCTOR

quickuml: 1 singleton(s)
  - uml.ui.IconManager

lexi: 1 singleton(s)
  - com.jmonkey.office.lexi.support.EditorActionManager

jrefac: 2 singleton(s)
  - org.acm.seguin.pretty.ai.RequiredTags
  - org.acm.seguin.uml.line.LabelSizeComputation

netbeans: 13 singleton(s)
  - org.netbeans.core.DataSystem
  - org.netbeans.core.FSPoolNode
  - org.netbeans.core.LoaderPoolNode
  - org.netbeans.core.NbControlPanel
  - org.netbeans.core.NbPlaces
  - org.netbeans.core.execution.ExecutionEngine
  - org.netbeans.core.windows.WindowManagerImpl
  - org.netbeans.core.windows.nodes.WorkspacePoolContext
  - org.netbeans.editor.Drawer
  - org.netbeans.editor.FindSupport
  - org.netbeans.modules.jarpackager.PackagingView
  - org.openide.actions.FolderNodeAcceptor
  - org.openide.awt.ToolbarPool

junit: 0 singleton(s)

jhotdraw: 1 singleton(s)
  - CH.ifa.draw.util.Clipboard

mapper: 2 singleton(s)
  - com.taursys.debug.Debug
  - com.taursys.tools.CodeGenerator

nutch: 1 singleton(s)
  - net.nutch.plugin.PluginRepository

PMD: 0 singleton(s)

============================================================
SÚHRN
============================================================
Projekt          Počet
-------------------------
quickuml             1
lexi                 1
jrefac               2
netbeans            13
junit                0
jhotdraw             1
mapper               2
nutch                1
PMD                  0
-------------------------
SPOLU               21

VŠETKY NÁJDENÉ TRIEDY:
  quickuml:
    uml.ui.IconManager
  lexi:
    com.jmonkey.office.lexi.support.EditorActionManager
  jrefac:
    org.acm.seguin.pretty.ai.RequiredTags
    org.acm.seguin.uml.line.LabelSizeComputation
  netbeans:
    org.netbeans.core.DataSystem
    org.netbeans.core.FSPoolNode
    org.netbeans.core.LoaderPoolNode
    org.netbeans.core.NbControlPanel
    org.netbeans.core.NbPlaces
    org.netbeans.core.execution.ExecutionEngine
    org.netbeans.core.windows.WindowManagerImpl
    org.netbeans.core.windows.nodes.WorkspacePoolContext
    org.netbeans.editor.Drawer
    org.netbeans.editor.FindSupport
    org.netbeans.modules.jarpackager.PackagingView
    org.openide.actions.FolderNodeAcceptor
    org.openide.awt.ToolbarPool
  jhotdraw:
    CH.ifa.draw.util.Clipboard
  mapper:
    com.taursys.debug.Debug
    com.taursys.tools.CodeGenerator
  nutch:
    net.nutch.plugin.PluginRepository