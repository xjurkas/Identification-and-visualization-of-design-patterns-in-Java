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

// Reciprocita s Element
AND EXISTS {
    MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
    MATCH (acceptMethod)-[:HAS_PARAMETER]->(param:Parameter)
    MATCH (param)-[:PARAMETER_TYPE]->(visitorType)
    WHERE toLower(acceptMethod.name) STARTS WITH "accept"
       OR toLower(acceptMethod.name) STARTS WITH "apply"
       OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
}

// NOVÉ: Aspoň jeden z A/B
AND (
    // A: ConcreteVisitor existuje
    EXISTS {
        MATCH (cv:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(visitorNode)
        WHERE cv.fqn <> visitorNode.fqn
    }
    OR
    // B: Aspoň jedna visit metóda má parameter typu, ktorý je "Element-like"
    //    (trieda ktorá sama má accept metódu s parametrom typu Visitor)
    EXISTS {
        MATCH (visitorType)-[:DECLARES]->(vm:Method)
        WHERE toLower(vm.name) STARTS WITH "visit"
        MATCH (vm)-[:HAS_PARAMETER]->(vp:Parameter)
        MATCH (vp)-[:PARAMETER_TYPE]->(vpType:Type)
        WHERE EXISTS {
            MATCH (vpType)-[:DECLARES]->(am:Method)-[:HAS_PARAMETER]->(ap:Parameter)-[:PARAMETER_TYPE]->(visitorType)
            WHERE toLower(am.name) STARTS WITH "accept"
               OR toLower(am.name) STARTS WITH "apply"
               OR toLower(am.name) STARTS WITH "jjtaccept"
        }
    }
)

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
