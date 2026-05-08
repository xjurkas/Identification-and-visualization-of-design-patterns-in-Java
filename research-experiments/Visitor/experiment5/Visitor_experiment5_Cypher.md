CALL {
MATCH (visitorNode)
WHERE visitorNode:Interface
   OR (visitorNode:Class AND (
         visitorNode.isAbstract = true
         OR EXISTS { MATCH (visitorNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      ))

MATCH (visitorType:Type {fqn: visitorNode.fqn})

WITH visitorNode, visitorType, [
    (visitorType)-[:DECLARES]->(m:Method)
    WHERE toLower(m.name) STARTS WITH "visit"
    | m
] AS visitMethods

WHERE size(visitMethods) >= 2

AND EXISTS {
    MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
    MATCH (acceptMethod)-[:HAS_PARAMETER]->(param:Parameter)
    MATCH (param)-[:PARAMETER_TYPE]->(visitorType)
    WHERE toLower(acceptMethod.name) STARTS WITH "accept"
       OR toLower(acceptMethod.name) STARTS WITH "apply"
       OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
}

AND EXISTS {
    MATCH (concreteVisitorClass:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(visitorNode)
    WHERE concreteVisitorClass.fqn <> visitorNode.fqn
}

// NOVÉ: Double dispatch — accept metóda na Element CALLS visit metódu na Visitor
AND EXISTS {
    MATCH (someElement:Type)-[:DECLARES]->(acceptMethod:Method)
    MATCH (acceptMethod)-[:HAS_PARAMETER]->(param:Parameter)
    MATCH (param)-[:PARAMETER_TYPE]->(visitorType)
    WHERE toLower(acceptMethod.name) STARTS WITH "accept"
       OR toLower(acceptMethod.name) STARTS WITH "apply"
       OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
    MATCH (acceptMethod)-[:CALLS]->(visitTarget:Method)
    MATCH (visitorType)-[:DECLARES]->(visitTarget)
    WHERE toLower(visitTarget.name) STARTS WITH "visit"
}

SET visitorType:Visitor

WITH visitorType
MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
MATCH (acceptMethod)-[:HAS_PARAMETER]->(param:Parameter)
MATCH (param)-[:PARAMETER_TYPE]->(visitorType)
WHERE toLower(acceptMethod.name) STARTS WITH "accept"
   OR toLower(acceptMethod.name) STARTS WITH "apply"
   OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
SET elementType:Element

RETURN DISTINCT visitorType, visitMethods, elementType, acceptMethod
}

WITH DISTINCT visitorType, visitMethods, elementType, acceptMethod
RETURN
  visitorType.fqn AS visitorFqn,
  [m IN visitMethods | m.name] AS visitMethodNames,
  size(visitMethods) AS visitMethodCount,
  collect(DISTINCT elementType.fqn) AS elementFqns,
  collect(DISTINCT acceptMethod.name) AS acceptMethodNames
ORDER BY visitorFqn;
