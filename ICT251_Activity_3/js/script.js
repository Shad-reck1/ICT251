"use strict";

// 1. Expand or collapse project details
document.querySelectorAll(".details-toggle").forEach(function (button) {
  button.addEventListener("click", function () {
    const details = document.getElementById(
      button.getAttribute("aria-controls")
    );

    const isOpening = details.hidden;
    details.hidden = !isOpening;
    button.setAttribute("aria-expanded", String(isOpening));
    button.textContent = isOpening ? "Hide details" : "Show details";
  });
});

// 2. Photo gallery with Previous and Next buttons
const photos = Array.from(document.querySelectorAll(".gallery-item"));
const previousButton = document.getElementById("previous-photo");
const nextButton = document.getElementById("next-photo");
const galleryStatus = document.getElementById("gallery-status");
let currentPhoto = 0;

function showPhoto(index) {
  if (photos.length === 0) return;

  // Keep the gallery within the first and last photo.
  currentPhoto = Math.max(0, Math.min(index, photos.length - 1));

  photos.forEach(function (photo, i) {
    photo.hidden = i !== currentPhoto;
  });

  galleryStatus.textContent =
    "Photo " + (currentPhoto + 1) + " of " + photos.length;

  previousButton.disabled = currentPhoto === 0;
  nextButton.disabled = currentPhoto === photos.length - 1;
}

previousButton.addEventListener("click", function () {
  showPhoto(currentPhoto - 1);
});

nextButton.addEventListener("click", function () {
  showPhoto(currentPhoto + 1);
});

showPhoto(0);

// 3. Search and filter projects or skills
const projectCards = Array.from(
  document.querySelectorAll(".project-card")
);
const searchInput = document.getElementById("project-search-input");
const resetSearchButton = document.getElementById("reset-project-search");
const searchStatus = document.getElementById("project-search-status");

function filterProjects() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  projectCards.forEach(function (card) {
    const matches = card.textContent.toLowerCase().includes(query);
    card.hidden = !matches;

    if (matches) visibleCount++;
  });

  searchStatus.textContent = visibleCount === 0
    ? "No projects match your search. Try another keyword."
    : "Showing " + visibleCount + " of " + projectCards.length + " projects.";
}

searchInput.addEventListener("input", filterProjects);

resetSearchButton.addEventListener("click", function () {
  searchInput.value = "";
  filterProjects();
  searchInput.focus();
});

// 4. Study hours calculator
const studyForm = document.getElementById("study-form");
const hoursInput = document.getElementById("hours-per-day");
const daysInput = document.getElementById("days-per-week");
const studyResult = document.getElementById("study-result");

studyForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const hours = hoursInput.value.trim();
  const days = daysInput.value.trim();
  const hoursNumber = Number(hours);
  const daysNumber = Number(days);

  if (
    hours === "" ||
    days === "" ||
    !Number.isFinite(hoursNumber) ||
    !Number.isFinite(daysNumber) ||
    hoursNumber < 0 ||
    daysNumber < 1 ||
    daysNumber > 7 ||
    !Number.isInteger(daysNumber)
  ) {
    studyResult.textContent =
      "Enter hours of zero or more and a whole number of study days from 1 to 7.";
    return;
  }

  studyResult.textContent =
    "Your planned weekly study time is " +
    (hoursNumber * daysNumber) +
    " hours.";
});

// 5. Contact form validation and local preview
const contactForm = document.getElementById("contact-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const messageInput = document.getElementById("message");
const topicInput = document.getElementById("topic");
const formStatus = document.getElementById("form-status");
const contactPreview = document.getElementById("contact-preview");

function setError(field, errorId, message) {
  document.getElementById(errorId).textContent = message;
  field.setAttribute("aria-invalid", message ? "true" : "false");
}

contactForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // Clear previous validation messages.
  setError(nameInput, "name-error", "");
  setError(emailInput, "email-error", "");
  setError(messageInput, "message-error", "");
  formStatus.textContent = "";
  contactPreview.hidden = true;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const message = messageInput.value.trim();
  let valid = true;

  if (name === "") {
    setError(nameInput, "name-error", "Please enter your name.");
    valid = false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    setError(emailInput, "email-error", "Enter a valid email address.");
    valid = false;
  }

  if (message === "") {
    setError(messageInput, "message-error", "Please enter a message.");
    valid = false;
  }

  if (!valid) {
    formStatus.textContent = "Please correct the highlighted fields.";
    return;
  }

  // textContent safely displays the user's input as text.
  document.getElementById("preview-name").textContent = name;
  document.getElementById("preview-email").textContent = email;
  document.getElementById("preview-topic").textContent =
    topicInput.value.trim() || "No topic provided";
  document.getElementById("preview-message").textContent = message;

  contactPreview.hidden = false;
  formStatus.textContent =
    "Your data was validated successfully in this browser. No message was sent.";
});