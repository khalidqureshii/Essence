import { DotLottieReact } from '@lottiefiles/dotlottie-react';

function Loader() {
    const serverMessage = "Almost There... Just a Moment!";
    return <div className="w-full h-80vh flex flex-col justify-center items-center">
        <div className="flex flex-col justify-center items-center">
            <DotLottieReact
                src="https://lottie.host/62a4c118-52f9-4dd3-8052-1b27216448e6/nTh20QwCcE.lottie"
                // Clock
                // src="https://lottie.host/08b99ebc-82d2-437d-9a1c-3143b14aabe2/6gGInrVoj9.json" 
                // Timer
                // src="https://lottie.host/d6090d99-4991-4c1c-977b-cd4e0c5b70b8/tqdxrb4DFm.lottie"
                // Bear
                // src="https://lottie.host/bddfdad6-93f7-48ab-b9e8-cc6411bcb982/Mo3yS0sWe1.lottie"
                // Hamster
                loop
                className="w-[40rem] md:w-[60rem]"
                autoplay
                speed={1.1}
            />
            <h2 className="text-xl md:text-3xl font-bold">{serverMessage}</h2>
        </div>
    </div>;
}

export default Loader;