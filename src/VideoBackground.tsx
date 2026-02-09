export default function VideoBackground() {
    return (
        <video
            autoPlay
            loop
            muted
            playsInline
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '133.33vw',  /* Compensate for 75% scale */
                height: '133.33vh',
                objectFit: 'cover',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.7
            }}
        >
            <source src="/intro.mp4" type="video/mp4" />
        </video>
    );
}
