"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../supabaseClient";
import { useParams } from "next/navigation";
import CardViewer from "@/components/CardViewer";
import { CardWithAnswers } from "@/components/CardViewer";
import BackButton from "@/components/BackButton";
import { displayName } from "@/lib/utils";
const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;
const QUIZ_LENGTH : number = 10;
export default function Quiz() {
    const [subtopicExists, setSubtopicExists] = useState<boolean>(true);
    const [chosenCards, setChosenCards] = useState<CardWithAnswers[]>([]);

    const isMounted = useRef(false);
    
    let cardsWithAnswers: CardWithAnswers[] = [];
    const { topic_name, subtopic_name } = useParams<{
        topic_name: string;
        subtopic_name: string;
    }>();

    const getTokenandSetHeaders = async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        const getParams = new URLSearchParams();
        getParams.append("topic", topic_name);
        getParams.append("subtopic", subtopic_name);

        return {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            params: getParams,
        };
    };

    const doesSubtopicExist: () => Promise<boolean> = async () => {
        const { headers, params } = await getTokenandSetHeaders();

        const data: { exists: boolean } = await fetch(
            `${backendURL}/subtopic/exists?${params}`,
            {
                headers: headers,
            },
        )
            .then(async (res) => {
                return await res.json();
            })
            .catch((error) => {
                console.error("Error checking subtopic existence:", error);
                return false; // Assume subtopic does not exist if there's an error})
            });

        return data.exists;
    };

    const getCards = async () => {
        const { headers, params } = await getTokenandSetHeaders();

        //cards returned are those who were not attempted yet
        //or attempted less than 3 times,
        //or whose mastery is less than 75%.
        const data = await fetch(`${backendURL}/card?${params}`, {
            headers: headers,
        }).then(async (res) => {
            return await res.json();
        });

        let getMoreCards : boolean = false;
        if (data) 
        {
            cardsWithAnswers = data as CardWithAnswers[];
            if (data.length < QUIZ_LENGTH)
            {
                getMoreCards = true;
            }

        } 
        
        if (getMoreCards || !data)
        {
            if (!isMounted.current)
            {
                isMounted.current = true; 
                //GENERATE new cards and set cardsWithAnswers to them.
                const newData = await fetch(`${backendURL}/card`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({
                        topic: topic_name,
                        subtopic: subtopic_name,
                    }),
                }).then(async (res) => {
                    return await res.json();
                });

                //add new generated cards to the existing cards that are not yet mastered.
                cardsWithAnswers = [...cardsWithAnswers, ...newData];
            }
            
        }

        //randomly select QUIZ_LENGTH cards out of all cards.
        const shuffled = [...cardsWithAnswers].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, QUIZ_LENGTH);

        setChosenCards(selected);
    };

    useEffect(() => {
        if (topic_name && subtopic_name) {
            doesSubtopicExist().then((exists) => {
                if (exists) {
                    setSubtopicExists(true);
                    getCards();
                } else {
                    setSubtopicExists(false);
                }
            });
        }
        isMounted.current = false;

    }, [topic_name, subtopic_name, subtopicExists]);

    return (
        <div>
            <BackButton
                path={"/" + topic_name}
                buttonText={"Back to " + displayName(topic_name)}
            />
            {(subtopicExists && (
                <>
                    <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
                        {displayName(topic_name)} - {displayName(subtopic_name)}
                    </h1>

                    <CardViewer cards={chosenCards} />
                </>
            )) || (
                <div className="text-center mt-10">
                    <h1 className="text-2xl font-bold text-red-600">
                        Subtopic does not exist!
                    </h1>
                    <p className="text-gray-600 mt-4">
                        Please create the subtopic first.
                    </p>
                </div>
            )}
        </div>
    );
}
