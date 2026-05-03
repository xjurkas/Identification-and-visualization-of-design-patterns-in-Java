Decorator — Experiment 1: Baseline
Date: 2026-04-29 14:52:33
Rule: interface component + field delegation (>=50% method interface, min 2) + concrete decorator subclass + concrete component exists

quickuml: 0 decorator(s)

lexi: 0 decorator(s)

jrefac: 0 decorator(s)

netbeans: 2 decorator(s)
  Decorator: org.netbeans.modules.java.JavaDocImpl
    Component interface: org.openide.src.JavaDoc
    Concrete decorator:  org.netbeans.modules.java.Method
    Concrete decorator:  org.netbeans.modules.java.Class
    Concrete decorator:  org.netbeans.modules.java.Field
  Decorator: org.openide.src.nodes.FilterFactory
    Component interface: org.openide.src.nodes.ElementNodeFactory
    Concrete decorator:  org.netbeans.modules.beans.PatternsBrowserFactory
    Concrete decorator:  org.netbeans.modules.javadoc.comments.JavaDocPropertySupportFactory
    Concrete decorator:  org.netbeans.modules.beans.PatternsExplorerFactory

junit: 1 decorator(s)
  Decorator: junit.extensions.TestDecorator
    Component interface: junit.framework.Test
    Concrete decorator:  junit.tests.new TestSetup() {...}
    Concrete decorator:  junit.extensions.RepeatedTest
    Concrete decorator:  junit.extensions.TestSetup

jhotdraw: 1 decorator(s)
  Decorator: CH.ifa.draw.standard.DecoratorFigure
    Component interface: CH.ifa.draw.framework.Figure
    Concrete decorator:  CH.ifa.draw.samples.javadraw.AnimationDecorator
    Concrete decorator:  CH.ifa.draw.figures.BorderDecorator

mapper: 0 decorator(s)

nutch: 0 decorator(s)

PMD: 0 decorator(s)