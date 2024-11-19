import React from "react";

function App() {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <main className="retro-container p-8">
        <div className="max-w-4xl mx-auto space-y-16 py-16">
          {/* Hero Section */}
          <section className="text-center space-y-6">
            <h1 className="text-6xl font-bold retro-glow">Anisur Rahman</h1>
            <p className="text-2xl gradient-text">Backend Engineer</p>
          </section>

          {/* About Section */}
          <section className="retro-border p-8 rounded-lg bg-zinc-900/50">
            <h2 className="text-3xl font-bold mb-6 gradient-text">About Me</h2>
            <div className="space-y-4 text-lg">
              <p>
                Since 2015, I've been on an exciting journey in the world of
                coding, turning professional in 2017. Over the past 4.5 years,
                I've had the privilege of working with four Y Combinator-backed
                startups, a major venture supported by Duracell, and a
                U.S.-based software agency.
              </p>
              <p>My expertise spans across:</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  "Python",
                  "JavaScript/TypeScript",
                  "ReactJs",
                  "NextJs",
                  "NodeJs",
                  "NestJs",
                ].map((tech) => (
                  <div
                    key={tech}
                    className="retro-border p-2 text-center rounded"
                  >
                    {tech}
                  </div>
                ))}
              </div>
              <p>
                I thrive on embracing challenges beyond my routine
                responsibilities and am always eager to master new technologies.
                Currently seeking opportunities to explore innovative tech
                landscapes and contribute meaningfully to the future of software
                development.
              </p>
            </div>
          </section>

          {/* Experience Section */}
          <section className="retro-border p-8 rounded-lg bg-zinc-900/50">
            <h2 className="text-3xl font-bold mb-6 gradient-text">
              Experience
            </h2>
            <div className="space-y-4 text-lg">
              <ul className="list-disc pl-5">
                <li>
                  Gerald (YC W21) - Backend Software Engineer (Aug 2022 -
                  Present)
                </li>
                <li>re:cruit - Software Engineer (May 2021 - Present)</li>
                <li>
                  Alpine DeFi - Backend Software Engineer (Jan 2022 - Jul 2022)
                </li>
                <li>
                  FIRST Delivery - Software Engineer (Apr 2022 - Jun 2022)
                </li>
                <li>
                  Edlyft - Backend Software Engineer (Feb 2021 - Dec 2021)
                </li>
                <li>
                  SJ Innovation LLC - Fullstack Software Engineer (Dec 2019 -
                  Feb 2021)
                </li>
                <li>
                  Social Energy - Full Stack Engineer (Dec 2017 - Dec 2019)
                </li>
                <li>
                  KWS3 Media Ltd. - Full Stack Engineer (Dec 2017 - Dec 2019)
                </li>
              </ul>
            </div>
          </section>

          {/* Education Section */}
          <section className="retro-border p-8 rounded-lg bg-zinc-900/50">
            <h2 className="text-3xl font-bold mb-6 gradient-text">Education</h2>
            <div className="space-y-4 text-lg">
              <p>Metropolitan University, Sylhet, Bangladesh</p>
              <p>Bachelor's degree in Computer Science (Apr 2015 - Apr 2019)</p>
            </div>
          </section>

          {/* Contact Section */}
          <section className="text-center space-y-6">
            <h2 className="text-3xl font-bold gradient-text">Get in Touch</h2>
            <a
              href="mailto:pshakilwizard@gmail.com"
              className="inline-block retro-border px-6 py-3 rounded hover:scale-105 transition-transform"
            >
              pshakilwizard@gmail.com
            </a>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
