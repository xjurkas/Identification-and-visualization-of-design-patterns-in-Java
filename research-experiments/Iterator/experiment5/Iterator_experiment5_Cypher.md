CALL {
MATCH (iteratorNode)
WHERE (iteratorNode:Interface
   OR (iteratorNode:Class AND (
         iteratorNode.isAbstract = true
         OR EXISTS { MATCH (iteratorNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      )))
  AND EXISTS { MATCH (iteratorNode)-[:IN_FILE]->() }

MATCH (iteratorType:Type {fqn: iteratorNode.fqn})

WITH iteratorNode, iteratorType
WHERE (
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m1:Method)
        WHERE toLower(m1.name) STARTS WITH "hasnext"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m2:Method)
        WHERE toLower(m2.name) STARTS WITH "next"
    })
    OR
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m3:Method)
        WHERE toLower(m3.name) STARTS WITH "hasmoreelements"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m4:Method)
        WHERE toLower(m4.name) STARTS WITH "nextelement"
    })
    OR
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m5:Method)
        WHERE toLower(m5.name) STARTS WITH "hasmore"
          AND NOT toLower(m5.name) STARTS WITH "hasmoreelements"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m6:Method)
        WHERE toLower(m6.name) STARTS WITH "next"
          AND NOT toLower(m6.name) STARTS WITH "nextelement"
    })
)

// NOVÉ: Aspoň jedno z A/B (permisívnejšia disjunkcia)
AND (
    EXISTS {
    MATCH (aggregateType:Type)-[:DECLARES]->(factoryMethod:Method)
    MATCH (factoryMethod)-[:RETURN_TYPE]->(iteratorType)
    WHERE toLower(factoryMethod.name) STARTS WITH "iterator"
       OR toLower(factoryMethod.name) STARTS WITH "createiterator"
       OR toLower(factoryMethod.name) STARTS WITH "elements"
       OR toLower(factoryMethod.name) STARTS WITH "getiterator"
       OR toLower(factoryMethod.name) STARTS WITH "getelements"
       OR toLower(factoryMethod.name) STARTS WITH "newiterator"
       OR toLower(factoryMethod.name) STARTS WITH "enum"
}
    OR
    EXISTS {
    MATCH (concreteIterClass:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(iteratorNode)
    WHERE concreteIterClass.fqn <> iteratorNode.fqn
}
)

SET iteratorType:Iterator
}
