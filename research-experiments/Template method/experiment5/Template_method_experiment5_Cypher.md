CALL {
MATCH (abstractNode:Class)
WHERE (abstractNode.isAbstract = true
       OR EXISTS { MATCH (abstractNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
  AND EXISTS { MATCH (abstractNode)-[:IN_FILE]->() }

MATCH (abstractType:Type {fqn: abstractNode.fqn})

WITH abstractNode, abstractType

// Existuje aspoň jedna podtrieda
WHERE EXISTS {
    MATCH (concreteClass:Class)-[:EXTENDS*1..3]->(abstractNode)
    WHERE concreteClass.fqn <> abstractNode.fqn
}

// Aspoň jedno z A/B:
// A) Template method CALLS primitive operation (ako P2 — striktné)
// B) ≥2 abstract metódy v triede (bohatá primitive operation sada — bežný TM signál)
AND (
    // A: CALLS diskriminátor
    EXISTS {
        MATCH (abstractType)-[:DECLARES]->(tm:Method)
        WHERE tm.isAbstract = false
           OR (NOT EXISTS { MATCH (tm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
               AND tm.isAbstract IS NULL)
        MATCH (tm)-[:CALLS]->(po:Method)
        MATCH (abstractType)-[:DECLARES]->(po)
        WHERE po.isAbstract = true
           OR EXISTS { MATCH (po)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
    }
    OR
    // B: ≥2 abstract metódy AND ≥1 concrete metóda (bez CALLS checku)
    (
        COUNT {
            MATCH (abstractType)-[:DECLARES]->(am:Method)
            WHERE am.isAbstract = true
               OR EXISTS { MATCH (am)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
        } >= 2
        AND
        EXISTS {
            MATCH (abstractType)-[:DECLARES]->(cm:Method)
            WHERE cm.isAbstract = false
               OR (NOT EXISTS { MATCH (cm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
                   AND cm.isAbstract IS NULL)
        }
    )
)

SET abstractType:AbstractClass
}
