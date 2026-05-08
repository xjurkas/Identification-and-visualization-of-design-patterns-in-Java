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

// Prah: aspoň 3 visit metódy (striktnejší)
WHERE size(visitMethods) >= 3

SET visitorType:Visitor

RETURN DISTINCT visitorType, visitMethods
}

RETURN DISTINCT
  visitorType.fqn AS visitorFqn,
  [m IN visitMethods | m.name] AS visitMethodNames,
  size(visitMethods) AS visitMethodCount
ORDER BY visitorFqn;
