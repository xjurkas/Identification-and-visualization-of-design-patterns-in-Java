Decorator — Experiment 3: Expand to abstact classes like Component
Date: 2026-04-29 14:56:54
Rule: Experiment 2 + Component can be Interface or abstract class
quickuml: 0 decorator(s)

lexi: 0 decorator(s)

jrefac: 0 decorator(s)

netbeans: 1 decorator(s)
  Decorator: org.openide.nodes.FilterNode
    Component: org.openide.nodes.NodeListener
    Component: org.openide.nodes.Node
    Concrete decorator:  org.netbeans.modules.group.GroupFilterNode
    Concrete decorator:  org.netbeans.core.ActionItemNode
    Concrete decorator:  org.netbeans.modules.apisupport.InstanceNode
    Concrete decorator:  org.openide.actions.PresentationFilterNode
    Concrete decorator:  org.netbeans.modules.apisupport.Filter
    Concrete decorator:  org.netbeans.examples.modules.breakpointview.BPViewNode
    Concrete decorator:  org.netbeans.modules.objectbrowser.TreeNode
    Concrete decorator:  org.netbeans.core.IconSubstituteNode
    Concrete decorator:  org.netbeans.modules.projects.ProjectFilterNode
    Concrete decorator:  org.openide.loaders.ShadowNode
    Concrete decorator:  org.netbeans.modules.apisupport.beanbrowser.Wrapper
    Concrete decorator:  org.netbeans.modules.projects.PresentationFilterNode
    Concrete decorator:  org.netbeans.modules.projects.settings.OptionsNode
    Concrete decorator:  org.netbeans.modules.projects.settings.SettingsNode
    Concrete decorator:  org.netbeans.modules.form.palette.PaletteItemNode
    Concrete decorator:  org.netbeans.core.MenuItemNode
    Concrete decorator:  org.netbeans.core.ToolbarItemNode

junit: 1 decorator(s)
  Decorator: junit.extensions.TestDecorator
    Component: junit.framework.Test
    Concrete decorator:  junit.extensions.RepeatedTest
    Concrete decorator:  junit.tests.new TestSetup() {...}
    Concrete decorator:  junit.extensions.TestSetup

jhotdraw: 1 decorator(s)
  Decorator: CH.ifa.draw.standard.DecoratorFigure
    Component: CH.ifa.draw.framework.Figure
    Concrete decorator:  CH.ifa.draw.figures.BorderDecorator
    Concrete decorator:  CH.ifa.draw.samples.javadraw.AnimationDecorator

mapper: 0 decorator(s)

nutch: 0 decorator(s)

PMD: 0 decorator(s)