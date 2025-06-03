"use client";

const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;
import { supabase } from "../supabaseClient";
import React, { useState, useEffect, useRef } from "react";

// Add custom CSS for 3D flip animation
const flipStyles = `
  .rotate-y-0 {
    transform: rotateY(0deg);
  }
  .rotate-y-180 {
    transform: rotateY(180deg);
  }
  .duration-600 {
    transition-duration: 600ms;
  }
`;

export type CardWithAnswers = {
    answer_type: string;
    created_at: string;
    id: string;
    level: number;
    question: string;
    subtopic_id: string;
    answers:
        | {
              card_id: string;
              correct_answer: string; // For free_text
              id: string;
          }
        | {
              card_id: string;
              correct_index: number; // For select
              id: string;
              options: string[];
          };
};

interface CardViewerProps {
    cards: CardWithAnswers[];
}

const LoadingSpinner: React.FC = () => {
    return (
            <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md font-[family-name:var(--font-geist-sans)]">
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 text-lg">Loading cards...</p>
            </div>
        </div>
    );
};

const CardViewer: React.FC<CardViewerProps> = ({ cards }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [showOnlyCorrectAnswer, setShowOnlyCorrectAnswer] = useState(false); // For "Show Answer" functionality
    const [isFlipping, setIsFlipping] = useState(false);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [isQuizComplete, setIsQuizComplete] = useState(false);

    const isMounted = useRef(false);

    // Reset state when card changes
    useEffect(() => {
        setSelectedOptionIndex(null);
        setShowOnlyCorrectAnswer(false);
        setIsFlipping(false);
        isMounted.current = false;
    }, [currentIndex]);

    // Show loading animation when no cards are available
    if (cards.length === 0) {
        return <LoadingSpinner />;
    }

    const currentCard = cards[currentIndex];

    const handleNext = () => {
        if (currentIndex < cards.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            setIsQuizComplete(true);
        }
    };

    const handleNewQuiz = () => {
        //forces a hard reload the page which will get new random cards
        window.location.href = window.location.href;
    };

    const handleOptionClick = (index: number) => {
        // Allow selection only if an option hasn't been selected yet OR if "Show Answer" hasn't been activated
        if (selectedOptionIndex === null && !showOnlyCorrectAnswer) {
            setSelectedOptionIndex(index);
        }
    };

    const handleShowAnswer = () => {
        setIsFlipping(true);
        // After flip animation completes, show the answer
        setTimeout(() => {
            setShowOnlyCorrectAnswer(true);
            setIsFlipping(false);
        }, 300); // Half of the flip duration (600ms total, flip at 300ms)
    };

    const isSelectAnswer = (
        answer: CardWithAnswers["answers"]
    ): answer is { card_id: string; correct_index: number; id: string; options: string[] } => {
        return "options" in answer && "correct_index" in answer;
    };

    const recordAnswer = async (isCorrect : boolean, currentCardId : string) =>
    {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            //fire and forget - do not await.
            fetch(`${backendURL}/card/recordAnswer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },                body: JSON.stringify({
                    isCorrect,
                    card_id: currentCardId
                }),
            });
    }
    
    let isNextButtonDisabled = false;
    let showShowAnswerButton = false;

    if (currentCard.answer_type === "select" && isSelectAnswer(currentCard.answers)) {
        if (selectedOptionIndex === null) {
            isNextButtonDisabled = true; // 1. next button is disabled until user selected an answer
        } else {
            const isCorrect = selectedOptionIndex === currentCard.answers.correct_index;
            if (!isCorrect) 
            {
                // 3. if the user selected the wrong answer
                isNextButtonDisabled = true; // Next stays disabled
                if (!showOnlyCorrectAnswer) {
                    showShowAnswerButton = true; // enable a button called "show answer"
                } else {
                    // After "Show Answer" is clicked, next should be enabled
                    isNextButtonDisabled = false;
                }
            }

            if (!isMounted.current)
            {
                isMounted.current = true; 
                //record user answer in our DB
                recordAnswer(isCorrect, currentCard.id);
                if (isCorrect)
                {
                    setCorrectAnswers((prev) => prev +1);
                }
            }
        }
    } else if (currentCard.answer_type === "free_text") {
        // For free_text, let's assume "Next" is enabled by default unless it's the last card.
        // If free_text also needs an interaction (e.g., reveal answer), this logic would change.
    }


if (isQuizComplete) {
    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md font-[family-name:var(--font-geist-sans)]">
            <div className="text-center">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                        {correctAnswers} / {cards.length}
                    </div>
                    <p className="text-gray-600 text-lg">
                        {correctAnswers === cards.length 
                            ? "Perfect score! Outstanding work!" 
                            : correctAnswers > cards.length / 2 
                            ? "Great job! You're doing well!"
                            : "Keep practicing! You'll improve with time."}
                    </p>
                    <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${(correctAnswers / cards.length) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            {Math.round((correctAnswers / cards.length) * 100)}% correct
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleNewQuiz}
                    className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition duration-200"
                >
                    Start New Quiz
                </button>
            </div>
        </div>
    );
    }
    return (
        <>
         <style>{flipStyles}</style>
        <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md font-[family-name:var(--font-geist-sans)]">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-700 mb-2">
                    Question {currentIndex + 1} of {cards.length}
                </h2>
                <p className="text-gray-800">{currentCard.question}</p>
            </div>

            {currentCard.answer_type === "free_text" && (
                <div className="bg-gray-100 p-3 rounded-md mt-3">
                    <p className="text-sm text-gray-600">Answer: </p>
                    {/* For free_text, you might want a button to reveal the answer */}
                    {/* And then currentCard.answers.correct_answer would be displayed */}
                    <p className="text-gray-800 pt-1">
                        {(currentCard.answers as { correct_answer: string }).correct_answer}
                    </p>
                </div>
            )}

            {currentCard.answer_type === "select" && isSelectAnswer(currentCard.answers) && (
                <div 
                    className={`mt-3 space-y-2 transition-transform duration-600 transform-gpu ${
                        isFlipping ? 'rotate-y-180' : 'rotate-y-0'
                    }`}
                    style={{
                        transformStyle: 'preserve-3d',
                        perspective: '1000px'
                    }}
                >
                    {currentCard.answers.options.map((option, index) => {
                        if (showOnlyCorrectAnswer && index !== currentCard.answers.correct_index) {
                            return null; // Hide wrong options if "Show Answer" was clicked
                        }

                        let borderColor = "border-gray-300";
                        let textColor = "text-gray-800";
                        let bgColor = "bg-gray-50";
                        let hoverBgColor = "hover:bg-gray-100";

                        if (selectedOptionIndex !== null && isSelectAnswer(currentCard.answers)) {
                            if (index === selectedOptionIndex ) {
                                if (index === currentCard.answers.correct_index) {
                                    borderColor = "border-green-500";
                                    textColor = "text-green-700";
                                    bgColor = "bg-green-50";
                                    hoverBgColor = "hover:bg-green-100";
                                } else {
                                    borderColor = "border-red-500";
                                    textColor = "text-red-700";
                                    bgColor = "bg-red-50";
                                    hoverBgColor = "hover:bg-red-100";
                                }
                            } else if (showOnlyCorrectAnswer && index === currentCard.answers.correct_index) {
                                // Ensure correct answer is styled green when specifically shown
                                borderColor = "border-green-500";
                                textColor = "text-green-700";
                                bgColor = "bg-green-50";
                            }
                        }
                        // If showing only correct answer, and this is it, ensure it's styled as correct
                        if (showOnlyCorrectAnswer && isSelectAnswer(currentCard.answers) && index === currentCard.answers.correct_index) {
                            borderColor = "border-green-500";
                            textColor = "text-green-700";
                            bgColor = "bg-green-50";
                            hoverBgColor = "hover:bg-green-100"; // No hover if it's the only one shown? Or keep it.
                        }


                        return (
                            <div
                                key={index}
                                onClick={() => handleOptionClick(index)}
                                className={`p-3 rounded-md border-2 ${borderColor} ${bgColor} ${textColor} ${ (selectedOptionIndex === null && !showOnlyCorrectAnswer) ? 'cursor-pointer ' + hoverBgColor : 'cursor-default'} transition duration-150`}
                                style={{
                                    backfaceVisibility: 'hidden'
                                }}
                            >
                                {option}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex justify-between mt-6 space-x-2">
                {showShowAnswerButton && currentCard.answer_type === "select" && (
                    <button
                        onClick={handleShowAnswer}
                        className="flex-1 py-2 px-4 bg-yellow-500 text-white font-semibold rounded-md shadow hover:bg-yellow-600 transition duration-200"
                    >
                        Show Answer
                    </button>
                )}
                {/* Placeholder for spacing if Show Answer button is not visible to maintain layout consistency */}
                {!showShowAnswerButton && currentCard.answer_type === "select" && (
                     <div className="flex-1"></div> // This takes up space
                )}


                <button
                    onClick={handleNext}
                    disabled={isNextButtonDisabled}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition duration-200 disabled:bg-blue-300 disabled:text-gray-100 disabled:cursor-not-allowed"
                >
                    {currentIndex === cards.length - 1 ? "Results" : "Next"}
                </button>
            </div>
        </div>
        </>
    );
};

export default CardViewer;